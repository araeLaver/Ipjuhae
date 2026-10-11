import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ refreshPolicyNews: vi.fn(), getPolicyNewsStatus: vi.fn() }))
vi.mock('@/lib/policy-news-store', () => mocks)
import { GET as cron } from '@/app/api/cron/policy-news/route'
import { GET as status } from '@/app/api/policy-news/status/route'

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  mocks.refreshPolicyNews.mockReset()
  mocks.getPolicyNewsStatus.mockReset()
  mocks.refreshPolicyNews.mockResolvedValue({ complete: true })
  mocks.getPolicyNewsStatus.mockResolvedValue({ status: 'ok' })
})

it('does not collect without the configured cron authorization', async () => {
  expect((await cron(new Request('http://localhost/api/cron/policy-news'))).status).toBe(401)
  expect(mocks.refreshPolicyNews).not.toHaveBeenCalled()
  vi.stubEnv('CRON_SECRET', '')
  expect((await cron(new Request('http://localhost/api/cron/policy-news', { headers: { authorization: 'Bearer ' } }))).status).toBe(401)
})

it('makes a partial upstream failure fail the external maintenance job', async () => {
  mocks.refreshPolicyNews.mockResolvedValue({ complete: false, failedWindows: 1 })
  expect((await cron(new Request('http://localhost/api/cron/policy-news', { headers: { authorization: 'Bearer test-secret' } }))).status).toBe(503)
})

it('accepts a refresh that is not due only when persisted freshness is healthy', async () => {
  mocks.refreshPolicyNews.mockResolvedValue({ skipped: true, reason: 'not_due' })
  const request = () => new Request('http://localhost/api/cron/policy-news', { headers: { authorization: 'Bearer test-secret' } })
  expect((await cron(request())).status).toBe(200)
  mocks.getPolicyNewsStatus.mockResolvedValue({ status: 'stale' })
  expect((await cron(request())).status).toBe(503)
})

it('reports stale or unavailable snapshots as uncached 503 without exposing secrets', async () => {
  mocks.getPolicyNewsStatus.mockResolvedValue({ status: 'unavailable', lastError: 'STORE_UNAVAILABLE' })
  const response = await status()
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.text()).not.toContain('test-secret')
})
