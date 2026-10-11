import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ query: vi.fn(), queryOne: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { GET } from '@/app/api/community/posts/route'
const id = '10000000-0000-4000-8000-000000000001'
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getCurrentUser).mockResolvedValue(null); vi.mocked(query).mockResolvedValue([]) })
it('validates saved question ids before querying', async () => {
  expect((await GET(new Request('http://localhost/api/community/posts?ids=invalid'))).status).toBe(400)
  expect(query).not.toHaveBeenCalled()
})
it('keeps anonymous saved-question reads scoped to the public audience', async () => {
  await GET(new Request(`http://localhost/api/community/posts?ids=${id}`))
  expect(vi.mocked(query).mock.calls[0][1]).toEqual([['all'],20,0,[id]])
  expect(vi.mocked(query).mock.calls[0][0]).toContain('p.audience = ANY($1::text[])')
})
it('drops author identifiers even if an unexpected DB field is returned', async () => {
  vi.mocked(query).mockResolvedValue([{id, title:'질문', author_id:'secret', author_hash:'secret', author_name:'secret', author_role:'member', has_operator_reply:false}])
  const result = await (await GET(new Request(`http://localhost/api/community/posts?ids=${id}`))).json()
  expect(JSON.stringify(result)).not.toContain('secret')
  expect(result.posts[0].has_operator_reply).toBe(false)
})
