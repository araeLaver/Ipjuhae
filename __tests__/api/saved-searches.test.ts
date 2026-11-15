import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ query: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/saved-search-alerts', () => ({ dispatchSavedSearchAlerts: vi.fn() }))
import { getCurrentUser } from '@/lib/auth'
import { query, transaction } from '@/lib/db'
import { GET, POST, PATCH, DELETE } from '@/app/api/saved-searches/route'
import { GET as cron } from '@/app/api/cron/saved-searches/route'
import { dispatchSavedSearchAlerts } from '@/lib/saved-search-alerts'
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const req = (method: string, body: unknown) => new Request('http://localhost/api/saved-searches', { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCurrentUser).mockResolvedValue({ id } as never) })
afterEach(() => vi.unstubAllEnvs())
it('all account endpoints reject unauthenticated requests before database access', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null)
  expect((await GET()).status).toBe(401)
  expect((await POST(req('POST', {}))).status).toBe(401)
  expect((await PATCH(req('PATCH', {}))).status).toBe(401)
  expect((await DELETE(req('DELETE', {}))).status).toBe(401)
  expect(query).not.toHaveBeenCalled()
  expect(transaction).not.toHaveBeenCalled()
})
it('invalid or unexpected filters and malformed IDs are rejected', async () => {
  expect((await POST(req('POST', { filters: { q: 'x'.repeat(101) } }))).status).toBe(400)
  expect((await POST(req('POST', { filters: { userId: id } }))).status).toBe(400)
  expect((await PATCH(req('PATCH', { id: 'invalid', alertsEnabled: true }))).status).toBe(400)
  expect((await DELETE(req('DELETE', { id: 'invalid' }))).status).toBe(400)
  expect(query).not.toHaveBeenCalled()
})
it('disabled alert service cannot accept opt-ins but permits turning alerts off', async () => {
  vi.stubEnv('SAVED_SEARCH_ALERTS_ENABLED', 'false')
  expect((await POST(req('POST', { filters: {}, alertsEnabled: true }))).status).toBe(503)
  expect((await PATCH(req('PATCH', { id, alertsEnabled: true }))).status).toBe(503)
  vi.mocked(query).mockResolvedValue([{ id, alerts_enabled: false }])
  expect((await PATCH(req('PATCH', { id, alertsEnabled: false }))).status).toBe(200)
})
it('cron rejects missing configuration and bad credentials before dispatch', async () => {
  vi.stubEnv('CRON_SECRET', '')
  expect((await cron(new Request('http://localhost/api/cron/saved-searches'))).status).toBe(401)
  vi.stubEnv('CRON_SECRET', 'test-secret')
  expect((await cron(new Request('http://localhost/api/cron/saved-searches', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401)
  expect(dispatchSavedSearchAlerts).not.toHaveBeenCalled()
})
it('cron dispatches only while enabled and reports failure instead of success', async () => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  const request = new Request('http://localhost/api/cron/saved-searches', { headers: { authorization: 'Bearer test-secret' } })
  vi.stubEnv('SAVED_SEARCH_ALERTS_ENABLED', 'false')
  expect((await cron(request)).status).toBe(200)
  expect(dispatchSavedSearchAlerts).not.toHaveBeenCalled()
  vi.stubEnv('SAVED_SEARCH_ALERTS_ENABLED', 'true')
  vi.mocked(dispatchSavedSearchAlerts).mockRejectedValue(new Error('DB unavailable'))
  expect((await cron(request)).status).toBe(500)
})
