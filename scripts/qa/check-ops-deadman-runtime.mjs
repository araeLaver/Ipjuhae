// 폐기 가능한 로컬 PostgreSQL과 완료된 npm run build가 필요하다.
import { Pool } from 'pg'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const connectionString = process.env.OPS_TEST_DATABASE_URL
if (!connectionString || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname)) {
  throw new Error('OPS_TEST_DATABASE_URL은 폐기 가능한 로컬 DB여야 합니다')
}
const schema = `deadman_runtime_${randomUUID().replaceAll('-', '')}`
const admin = new Pool({ connectionString })
const db = new Pool({ connectionString, options: `-c search_path=${schema}` })
const port = Number(process.env.OPS_TEST_HTTP_PORT || 18089)
const secret = randomUUID()
let child
let logs = ''
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, USER: process.env.USER,
  NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port),
  DATABASE_URL: connectionString, DB_SCHEMA: schema, DATABASE_SSL: 'false',
  NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
  OPS_DEADMAN_ENABLED: 'true', OPS_HEARTBEAT_SECRET: secret,
  OPS_ALERT_EMAIL: 'test@example.invalid', RESEND_API_KEY: 'test-only-no-send',
  UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
}
const state = async () => (await db.query('SELECT * FROM ops_deadman_state')).rows[0]
async function stop() {
  if (!child || child.exitCode !== null) return
  const processToStop = child
  await new Promise(resolve => {
    processToStop.once('exit', resolve)
    processToStop.kill('SIGTERM')
    const timer = setTimeout(() => processToStop.kill('SIGKILL'), 5000)
    timer.unref()
  })
  child = null
}
async function start() {
  child = spawn(process.execPath, ['server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', b => { logs += b.toString() })
  child.stderr.on('data', b => { logs += b.toString() })
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('테스트 HTTP 서버 조기 종료')
    if ((await state())?.evaluation_count) return
    await delay(100)
  }
  throw new Error(`앱 내부 판정 시작 timeout: ${logs}`)
}
try {
  await admin.query(`CREATE SCHEMA ${schema}`)
  await db.query(readFileSync('db/migration-045-ops-deadman.sql', 'utf8'))
  await start()
  const before = await state()
  const url = `http://127.0.0.1:${port}/api/ops/heartbeat`
  for (const authorization of ['', 'Bearer wrong']) {
    assert.equal((await fetch(url, { method: 'POST', headers: { authorization } })).status, 401)
  }
  assert.equal((await state()).last_received_at, null)
  const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } })
  assert.equal(response.status, 200)
  const receipt = (await response.json()).receivedAt
  assert.equal((await state()).last_received_at.toISOString(), receipt)
  await stop()
  // 실제 프로세스 재시작. 새 서버의 즉시 판정을 기다린다.
  await start()
  for (let i = 0; i < 100 && Number((await state()).evaluation_count) < 2; i++) await delay(100)
  const restarted = await state()
  assert.equal(restarted.armed_at.toISOString(), before.armed_at.toISOString())
  assert.equal(restarted.last_received_at.toISOString(), receipt)
  assert.ok(Number(restarted.evaluation_count) >= 2)
  const count = Number(restarted.evaluation_count)
  for (let i = 0; i < 65 && Number((await state()).evaluation_count) === count; i++) await delay(1000)
  const after = await state()
  assert.equal(Number(after.evaluation_count), count + 1)
  assert.ok(after.last_evaluation_gap_ms >= 59_000 && after.last_evaluation_gap_ms < 65_000)
  assert.ok(!logs.includes('tick_failed') && !logs.includes('scheduler_start_failed'))
  console.log(JSON.stringify({ result: 'PASS', unauthorized: 401, accepted: 200, persistedAcrossProcessRestart: true, measuredTickGapMs: after.last_evaluation_gap_ms, externalEmailSent: false }))
} finally {
  await stop()
  await db.end()
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
  await admin.end()
}
