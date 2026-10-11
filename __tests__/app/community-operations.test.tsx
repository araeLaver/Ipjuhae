import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ query: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw Error('redirect') }) }))
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import Questions from '@/app/admin/community/page'
beforeEach(() => vi.clearAllMocks())
it('blocks non-admin access before any query', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({user_type:'tenant'} as never)
  await expect(Questions({searchParams:Promise.resolve({})})).rejects.toThrow('redirect')
  expect(query).not.toHaveBeenCalled()
})
it('distinguishes failed queries from an empty queue', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({user_type:'admin'} as never)
  vi.mocked(query).mockRejectedValue(Error('offline'))
  const html=renderToStaticMarkup(await Questions({searchParams:Promise.resolve({})}))
  expect(html).toContain('목록을 불러오지 못했습니다')
  expect(html).not.toContain('이 상태의 질문이 없습니다')
})
it('renders the reply path and queries waiting only by default', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({user_type:'admin'} as never)
  vi.mocked(query).mockResolvedValue([{id:'q',title:'질문',audience:'all',created_at:new Date().toISOString(),has_operator_reply:false}])
  const html=renderToStaticMarkup(await Questions({searchParams:Promise.resolve({})}))
  expect(html).toContain('/community/q#reply')
  expect(vi.mocked(query).mock.calls[0][1]).toEqual([false])
})
