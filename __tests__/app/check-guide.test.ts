import { beforeEach, expect, it, vi } from 'vitest'
const { queryOne, redirect, notFound } = vi.hoisted(() => ({
  queryOne: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`) }),
  notFound: vi.fn(() => { throw new Error('notFound') }),
}))
vi.mock('@/lib/db', () => ({ queryOne }))
vi.mock('next/navigation', () => ({ redirect, notFound }))
import GuidePage from '@/app/guides/deungi/[episode]/page'
beforeEach(() => vi.clearAllMocks())
it('resolves only an admin guide visible to everyone', async () => {
  queryOne.mockResolvedValue({ id: 'public-guide' })
  await expect(GuidePage({ params: Promise.resolve({ episode: '3' }) })).rejects.toThrow('redirect:/community/public-guide')
  const [sql, params] = queryOne.mock.calls[0]
  expect(sql).toContain("u.user_type = 'admin'")
  expect(sql).toContain("p.audience = 'all'")
  expect(sql).toContain('p.hidden_at IS NULL AND p.deleted_at IS NULL')
  expect(params).toEqual(['등기부 뜯어보기 3화.%'])
})
it('rejects malformed episode paths before querying', async () => {
  await expect(GuidePage({ params: Promise.resolve({ episode: '3secret' }) })).rejects.toThrow('notFound')
  expect(queryOne).not.toHaveBeenCalled()
})
it('shows a recovery page on query failure rather than sending people home', async () => {
  queryOne.mockRejectedValue(new Error('offline'))
  const page = await GuidePage({ params: Promise.resolve({ episode: '10' }) })
  expect(page).toBeTruthy()
  expect(redirect).not.toHaveBeenCalled()
})
it('shows a recovery page when the guide is unavailable', async () => {
  queryOne.mockResolvedValue(null)
  expect(await GuidePage({ params: Promise.resolve({ episode: '10' }) })).toBeTruthy()
  expect(redirect).not.toHaveBeenCalled()
})
