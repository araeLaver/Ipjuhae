import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/db',()=>({query:vi.fn(),queryOne:vi.fn(),transaction:vi.fn()}))
vi.mock('@/lib/auth',()=>({getCurrentUser:vi.fn()}))
import { GET } from '@/app/api/community/posts/[id]/comments/route'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
const read = ()=>GET(new Request('http://localhost/api/community/posts/p1/comments'),{params:Promise.resolve({id:'p1'})})
beforeEach(()=>{
  vi.clearAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(null)
  vi.mocked(queryOne).mockResolvedValue({id:'p1',audience:'all',author_id:'u1'})
})
it('조회 SQL은 삭제·숨김을 제외하고 운영자 역할을 반환한다',async()=>{
  const rows=[{id:'c1',author_role:'admin',body:'운영자 답변'}]
  vi.mocked(query).mockResolvedValue(rows)
  const response=await read()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({comments:rows})
  const [sql,args]=vi.mocked(query).mock.calls[0]
  expect(sql).toMatch(/c\.deleted_at IS NULL/)
  expect(sql).toMatch(/c\.hidden_at IS NULL/)
  expect(sql).toMatch(/AS author_role/)
  expect(args).toEqual(['p1'])
})
it('없는 게시글에는 404를 반환하고 댓글을 조회하지 않는다',async()=>{
  vi.mocked(queryOne).mockResolvedValue(null)
  expect((await read()).status).toBe(404)
  expect(query).not.toHaveBeenCalled()
})
it('댓글 조회 실패는 빈 성공 목록 대신 500을 반환한다',async()=>{
  vi.mocked(query).mockRejectedValue(new Error('검증용 DB 오류'))
  expect((await read()).status).toBe(500)
})
