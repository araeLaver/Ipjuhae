import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getPolicyNewsSnapshot: vi.fn(), refreshPolicyNews: vi.fn() }))
vi.mock('@/lib/policy-news-store', () => mocks)
import { GET } from '@/app/api/policy-news/route'

it('returns stored public articles without running the collector', async () => {
  const snapshot = { items: [{ id: 'one', title: '청약 안내' }], health: { status: 'ok', lastSuccessAt: '2026-10-11T01:00:00Z' } }
  mocks.getPolicyNewsSnapshot.mockResolvedValue(snapshot)
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual(snapshot)
  expect(mocks.refreshPolicyNews).not.toHaveBeenCalled()
})

it('keeps the last good articles on degraded collection, with an unhealthy HTTP status', async () => {
  mocks.getPolicyNewsSnapshot.mockResolvedValue({ items: [{ id: 'one' }], health: { status: 'degraded' } })
  const response = await GET()
  expect(response.status).toBe(503)
  expect((await response.json()).items).toHaveLength(1)
})
