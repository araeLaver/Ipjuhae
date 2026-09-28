import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const db = vi.hoisted(() => ({ pool: null as Pool | null }))
vi.mock('@/lib/db', () => ({
  transaction: async (fn: (client: import('pg').PoolClient) => Promise<unknown>) => {
    const client = await db.pool!.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  },
}))
import { heartbeatAuthorized, monitoringConfigured, receiveHeartbeat, evaluateDeadman, dispatchDeadman, startDeadmanScheduler } from '@/lib/ops-deadman'
import { POST } from '@/app/api/ops/heartbeat/route'

beforeEach(() => {
  vi.stubEnv('OPS_HEARTBEAT_SECRET', 'test-only-secret-32-characters-long')
  vi.stubEnv('OPS_DEADMAN_ENABLED', 'true')
  vi.stubEnv('OPS_ALERT_EMAIL', 'test@example.invalid')
  vi.stubEnv('RESEND_API_KEY', 'test-only')
  vi.stubEnv('DATABASE_URL', 'postgres://unused')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('인증 누락·오류·약한 설정은 차단하고 정확한 별도 토큰만 허용한다', () => {
  expect(heartbeatAuthorized(null)).toBe(false)
  expect(heartbeatAuthorized('Bearer wrong')).toBe(false)
  expect(heartbeatAuthorized(`Bearer ${process.env.OPS_HEARTBEAT_SECRET}`)).toBe(true)
  vi.stubEnv('OPS_HEARTBEAT_SECRET', '')
  expect(heartbeatAuthorized('Bearer ')).toBe(false)
  expect(monitoringConfigured()).toBe(false)
})
it('비활성 API는 성공 핑으로 오인시키지 않는다', async () => {
  vi.stubEnv('OPS_DEADMAN_ENABLED', 'false')
  expect((await POST(new Request('http://localhost/api/ops/heartbeat', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPS_HEARTBEAT_SECRET}` } }))).status).toBe(503)
})
it('설정 오류를 제품 기동 예외로 전파하지 않고 60초마다 다시 확인한다', async () => {
  vi.useFakeTimers()
  vi.stubEnv('RESEND_API_KEY', '')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const stop = startDeadmanScheduler()
  expect(log).toHaveBeenCalledWith('[ops-deadman] configuration_invalid')
  await vi.advanceTimersByTimeAsync(120_000)
  expect(log).toHaveBeenCalledTimes(3)
  stop()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(log).toHaveBeenCalledTimes(3)
  log.mockRestore()
})

const testDb = process.env.OPS_TEST_DATABASE_URL
describe.skipIf(!testDb)('임시 PostgreSQL 통합 검증', () => {
  const schema = `deadman_test_${randomUUID().replaceAll('-', '')}`
  let admin: Pool
  beforeAll(async () => {
    admin = new Pool({ connectionString: testDb })
    await admin.query(`CREATE SCHEMA ${schema}`)
    db.pool = new Pool({ connectionString: testDb, options: `-c search_path=${schema}`, max: 5 })
    await db.pool.query(readFileSync('db/migration-045-ops-deadman.sql', 'utf8'))
  })
  afterAll(async () => {
    await db.pool?.end()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
  })
  beforeEach(async () => {
    await db.pool!.query('TRUNCATE ops_deadman_events, ops_deadman_state')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-test' }), { status: 200 })))
  })
  const state = async () => (await db.pool!.query('SELECT * FROM ops_deadman_state')).rows[0]
  const events = async () => (await db.pool!.query('SELECT * FROM ops_deadman_events ORDER BY created_at')).rows
  const stale = async () => {
    await evaluateDeadman()
    await db.pool!.query("UPDATE ops_deadman_state SET armed_at=clock_timestamp()-interval '7 minutes', last_evaluated_at=clock_timestamp()-interval '2 minutes'")
    await evaluateDeadman()
  }
  it('최초 핑이 없어도 grace 이후 경보를 한 번 생성하고 판정 공백을 기록한다', async () => {
    await stale()
    await evaluateDeadman()
    expect((await events()).map(e => e.kind)).toEqual(['stale'])
    expect((await state()).max_evaluation_gap_ms).toBeGreaterThanOrEqual(120_000)
    expect((await events())[0].payload.text).toContain('최초 핑 없음')
  })
  it('무인증/잘못된 핑은 DB를 갱신하지 않고 올바른 핑은 서버 시각을 저장한다', async () => {
    for (const authorization of ['', 'Bearer wrong']) {
      expect((await POST(new Request('http://localhost/api/ops/heartbeat', { method: 'POST', headers: { authorization } }))).status).toBe(401)
    }
    expect(await state()).toBeUndefined()
    const response = await POST(new Request('http://localhost/api/ops/heartbeat', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPS_HEARTBEAT_SECRET}` } }))
    expect(response.status).toBe(200)
    expect((await response.json()).receivedAt).toBe((await state()).last_received_at.toISOString())
    await receiveHeartbeat()
    expect((await state()).last_receive_gap_ms).toBeGreaterThanOrEqual(0)
  })
  it('동시 판정·회복 후 새 누락은 전환별 이벤트만 생성한다', async () => {
    await stale()
    await Promise.all([evaluateDeadman(), evaluateDeadman(), evaluateDeadman()])
    await receiveHeartbeat()
    await Promise.all([evaluateDeadman(), evaluateDeadman()])
    await db.pool!.query("UPDATE ops_deadman_state SET last_received_at=clock_timestamp()-interval '6 minutes'")
    await evaluateDeadman()
    expect((await events()).map(e => e.kind)).toEqual(['stale', 'recovered', 'stale'])
  })
  it('프로세스의 DB 연결을 재생성해도 최초 기산점과 경보 상태가 유지된다', async () => {
    await stale()
    const before = await state()
    await db.pool!.end()
    db.pool = new Pool({ connectionString: testDb, options: `-c search_path=${schema}`, max: 5 })
    await evaluateDeadman()
    expect((await state()).armed_at).toEqual(before.armed_at)
    expect(await events()).toHaveLength(1)
  })
  it('발송 실패를 재시도하고 동일 키·본문을 유지하며 성공 후 중복 전송하지 않는다', async () => {
    await stale()
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockImplementation(async () => new Response(JSON.stringify({ id: 'accepted' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await dispatchDeadman()
    expect((await events())[0].delivery_status).toBe('pending')
    await db.pool!.query("UPDATE ops_deadman_events SET last_attempt_at=clock_timestamp()-interval '61 seconds'")
    vi.stubEnv('OPS_ALERT_EMAIL', 'changed@example.invalid')
    await Promise.all([dispatchDeadman(), dispatchDeadman()])
    await dispatchDeadman()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body)
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetchMock.mock.calls[1][1].headers['Idempotency-Key'])
    expect((await events())[0].delivery_status).toBe('sent')
  })
  it('모호한 발송 결과는 23시간 이후 자동 재발송을 중지해 키 만료 중복을 막는다', async () => {
    await stale()
    await db.pool!.query("UPDATE ops_deadman_events SET first_attempt_at=clock_timestamp()-interval '24 hours'")
    await dispatchDeadman()
    expect((await events())[0].delivery_status).toBe('uncertain')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('메일 500 응답은 id가 있어도 성공 처리하지 않는다', async () => {
    await stale()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'invalid' }), { status: 500 })))
    await dispatchDeadman()
    expect((await events())[0].delivery_status).toBe('pending')
  })
  it('DB 장애 시 2xx를 반환하지 않는다', async () => {
    await db.pool!.query('ALTER TABLE ops_deadman_state RENAME TO temporarily_unavailable')
    try {
      expect((await POST(new Request('http://localhost/api/ops/heartbeat', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPS_HEARTBEAT_SECRET}` } }))).status).toBe(503)
    } finally { await db.pool!.query('ALTER TABLE temporarily_unavailable RENAME TO ops_deadman_state') }
  })
})
