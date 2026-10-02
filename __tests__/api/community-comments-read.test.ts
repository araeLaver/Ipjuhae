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
  expect(await response.json()).toEqual({comments:rows,total:0,nextCursor:null})
  const [sql,args]=vi.mocked(query).mock.calls[0]
  expect(sql).toMatch(/c\.deleted_at IS NULL/)
  expect(sql).toMatch(/c\.hidden_at IS NULL/)
  expect(sql).toMatch(/AS author_role/)
  expect(args).toEqual(['p1',null,null,null])
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

it('201번째 댓글은 다음 커서로 조회하고 전체 공개 개수를 별도로 반환한다', async () => {
  const time = '2026-09-27 01:00:00.123456+00'
  const rows = Array.from({length:201}, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,
    body: `댓글 ${i}`, created_at: time, cursor_time: time, author_role: 'member',
  }))
  vi.mocked(queryOne).mockResolvedValueOnce({id:'p1',audience:'all',author_id:'u1'}).mockResolvedValueOnce({total:'201'})
  vi.mocked(query).mockResolvedValueOnce(rows)
  const first = await (await read()).json()
  expect(first.comments).toHaveLength(200)
  expect(first.total).toBe(201)
  expect(first.comments[0]).not.toHaveProperty('cursor_time')
  expect(JSON.parse(Buffer.from(first.nextCursor,'base64url').toString())).toEqual({time,id:rows[199].id})
  vi.mocked(queryOne).mockResolvedValueOnce({id:'p1',audience:'all',author_id:'u1'}).mockResolvedValueOnce({total:'201'})
  vi.mocked(query).mockResolvedValueOnce(rows.slice(200))
  const second = await (await GET(new Request(`http://localhost/comments?cursor=${first.nextCursor}`),{params:Promise.resolve({id:'p1'})})).json()
  expect(second.comments.map((c: {id:string})=>c.id)).toEqual([rows[200].id])
  expect(second.nextCursor).toBeNull()
  expect(vi.mocked(query).mock.calls[1][1]).toEqual(['p1',time,rows[199].id,null])
  expect(vi.mocked(query).mock.calls[1][0]).toContain('ORDER BY c.created_at ASC, c.id ASC')
  expect(vi.mocked(queryOne).mock.calls[1][0]).toMatch(/deleted_at IS NULL AND hidden_at IS NULL/)
})
it('잘못된 커서는 DB 댓글 조회 전에 400으로 거절한다', async () => {
  const response=await GET(new Request('http://localhost/comments?cursor=invalid'),{params:Promise.resolve({id:'p1'})})
  expect(response.status).toBe(400)
  expect(query).not.toHaveBeenCalled()
})
