import { describe, expect, it, vi, beforeEach } from 'vitest'
import { collectPolicyNews, parsePolicyNews } from '@/lib/policy-news'

const mocks = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), release: vi.fn(), queryOne: vi.fn() }))
vi.mock('@/lib/db', () => ({ default: { connect: mocks.connect }, queryOne: mocks.queryOne }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))
import { mergePolicyNews, policyStatus, refreshPolicyNews, startPolicyNewsScheduler } from '@/lib/policy-news-store'

const item = { id: 'one', title: '전세 지원', summary: '', url: 'https://www.korea.kr/news/one', approvedAt: '2026-10-01', ministry: '' }
const xml = (code = '0', total = 1) => `<response><header><resultCode>${code}</resultCode></header><body><NewsItem><Title>전세 지원</Title><OriginalUrl>https://www.korea.kr/news/one</OriginalUrl><ApproveDate>10/01/2026 12:00:00</ApproveDate><NewsItemId>one</NewsItemId></NewsItem><totalCount>${total}</totalCount></body></response>`

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  mocks.query.mockReset()
  mocks.release.mockReset()
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release })
})

describe('policy collection', () => {
  it('rejects upstream error XML despite HTTP 200 and malformed bodies', () => {
    expect(() => parsePolicyNews(xml('30'))).toThrow('POLICY_API_ERROR')
    expect(() => parsePolicyNews('<html>error</html>')).toThrow()
    expect(parsePolicyNews(xml())).toHaveLength(1)
  })
  it('checks all 45 days using KST dates and deduplicates', async () => {
    const request = vi.fn().mockResolvedValue(new Response(xml()))
    // Each call needs a fresh response body.
    request.mockImplementation(async () => new Response(xml()))
    const result = await collectPolicyNews('secret', new Date('2026-10-04T15:05:00Z'), request)
    expect(result).toMatchObject({ failedWindows: 0, checkedWindows: 15 })
    expect(result.items).toHaveLength(1)
    expect(String(request.mock.calls[0][0])).toContain('endDate=20261005')
    expect(request).toHaveBeenCalledTimes(15)
    expect(request.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
  })
  it('paginates and reports a failed recent window without throwing away other windows', async () => {
    const request = vi.fn(async (url: string | URL | Request) => {
      const params = new URL(String(url)).searchParams
      if (params.get('endDate') === '20261005') return new Response(xml('30'))
      return new Response(xml('0', params.get('pageNo') === '1' ? 101 : 1))
    })
    const result = await collectPolicyNews('secret', new Date('2026-10-05T01:00:00Z'), request)
    expect(result).toMatchObject({ failedWindows: 1, checkedWindows: 14 })
    expect(request).toHaveBeenCalledTimes(29)
    expect(result.items).toHaveLength(1)
  })
})

describe('durable refresh', () => {
  it('reports stale even if older articles exist, and accepts successful empty feeds', () => {
    const now = new Date('2026-10-05T02:00:00Z')
    expect(policyStatus({ items: [item], last_attempt_at: now, last_success_at: new Date('2026-10-03T02:00:00Z'), failed_windows: 1, last_error: 'UPSTREAM_PARTIAL_FAILURE' }, now).status).toBe('stale')
    expect(policyStatus({ items: [], last_attempt_at: now, last_success_at: now, failed_windows: 0, last_error: null }, now).status).toBe('ok')
  })
  it('merges new articles with the last good snapshot on partial failures', () => {
    expect(mergePolicyNews([item], [{ ...item, id: 'two', approvedAt: '2026-10-02' }]).map(n => n.id)).toEqual(['two', 'one'])
  })
  it('preserves the DB snapshot and last-success timestamp on upstream failure', async () => {
    vi.stubEnv('PUBLIC_DATA_API_KEY', 'secret')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(xml('30'))))
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] }
      if (sql.startsWith('SELECT *')) return { rows: [{ items: [item], last_attempt_at: null, last_error: null }] }
      if (sql.includes('RETURNING api_calls')) return { rows: [{ api_calls: 1 }], rowCount: 1 }
      return { rows: [], rowCount: 1 }
    })
    expect(await refreshPolicyNews()).toMatchObject({ complete: false, count: 1, failedWindows: 15 })
    const update = mocks.query.mock.calls.find(([sql]) => sql.includes('SET items'))!
    expect(JSON.parse(update[1][0])).toEqual([item])
    expect(update[1][1]).toBe(false)
    expect(mocks.query.mock.calls.at(-1)![0]).toContain('pg_advisory_unlock')
    expect(mocks.release).toHaveBeenCalledOnce()
  })
  it('prevents concurrent collection and requires API configuration', async () => {
    vi.stubEnv('PUBLIC_DATA_API_KEY', '')
    await expect(refreshPolicyNews()).rejects.toThrow('POLICY_API_KEY_MISSING')
    vi.stubEnv('PUBLIC_DATA_API_KEY', 'secret')
    mocks.query.mockResolvedValue({ rows: [{ locked: false }] })
    expect(await refreshPolicyNews()).toMatchObject({ skipped: true, reason: 'running' })
    expect(mocks.release).toHaveBeenCalledOnce()
  })
  it('never exceeds the shared daily budget even after restarts', async () => {
    vi.stubEnv('PUBLIC_DATA_API_KEY', 'secret')
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] }
      if (sql.startsWith('SELECT *')) return { rows: [{ items: [item], last_attempt_at: null, last_error: null }] }
      return { rows: [], rowCount: 0 }
    })
    expect(await refreshPolicyNews()).toMatchObject({ complete: false, count: 1 })
    expect(request).not.toHaveBeenCalled()
  })
  it('starts collecting without a page request and stops the interval on close', async () => {
    vi.useFakeTimers()
    vi.stubEnv('PUBLIC_DATA_API_KEY', 'secret')
    mocks.query.mockResolvedValue({ rows: [{ locked: false }] })
    const stop = startPolicyNewsScheduler()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.connect).toHaveBeenCalled()
    const first = mocks.connect.mock.calls.length
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)
    expect(mocks.connect.mock.calls.length).toBe(first + 1)
    stop()
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)
    expect(mocks.connect.mock.calls.length).toBe(first + 1)
    vi.useRealTimers()
  })
})
