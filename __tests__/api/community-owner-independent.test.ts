import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }))
import { getCurrentUser } from '@/lib/auth'
import { queryOne, transaction } from '@/lib/db'
import { PATCH, DELETE } from '@/app/api/community/posts/[id]/route'
import { DELETE as remove } from '@/app/api/community/posts/[id]/comments/[commentId]/route'
const A = 'a1000000-0000-4000-8000-000000000001'
const B = 'b1000000-0000-4000-8000-000000000002'
const id = 'c1000000-0000-4000-8000-000000000003'
const commentId = 'd1000000-0000-4000-8000-000000000004'
const ctx = { params: Promise.resolve({ id }) }
const cctx = { params: Promise.resolve({ id, commentId }) }
const request = (data: unknown = {}) => new Request('http://localhost/qa', { method: 'PATCH', body: JSON.stringify(data) })
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCurrentUser).mockResolvedValue({ id: A, user_type: 'tenant' } as never) })
it.each([B, null])('별도 A/B/동일 hash 익명 글 fixture에서 소유권 거부: %s', async author_id => {
  vi.mocked(queryOne).mockResolvedValue({ author_id, author_hash: '동일한_합성_hash' })
  expect((await PATCH(request({ title: '독립 수정' }), ctx)).status).toBe(403)
  expect((await DELETE(request(), ctx)).status).toBe(403)
  expect(vi.mocked(queryOne).mock.calls.every(([sql]) => !sql.includes('UPDATE'))).toBe(true)
})
it('비로그인은 글과 댓글 변경 모두 DB 접근 전에 거부한다', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null)
  for (const fn of [PATCH, DELETE]) expect((await fn(request(), ctx)).status).toBe(401)
  expect((await remove(request(), cctx)).status).toBe(401)
  expect(queryOne).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled()
})
it.each(['author_hash', 'deleted_at', 'hidden_at', 'audience'])('본인도 허용되지 않은 필드 %s를 변경할 수 없다', async field => {
  vi.mocked(queryOne).mockResolvedValue({ author_id: A })
  expect((await PATCH(request({ title: '합성', [field]: '합성 변경' }), ctx)).status).toBe(400)
  expect(queryOne).toHaveBeenCalledTimes(1)
})
it('댓글 삭제 시 다른 post ID를 전달하면 소유권 조회 전에 대상 불일치로 거부한다', async () => {
  const q = vi.fn().mockResolvedValueOnce({ rows: [{ author_id: B, audience: 'all' }] }).mockResolvedValueOnce({ rows: [] })
  vi.mocked(transaction).mockImplementation(async fn => fn({ query: q } as never))
  expect((await remove(request(), cctx)).status).toBe(404)
  expect(q.mock.calls[1][1]).toEqual([commentId, id]); expect(q).toHaveBeenCalledTimes(2)
})
it.each([B, null])('본인 글에 달린 타인/동일 hash 익명 댓글도 삭제하지 못한다: %s', async author_id => {
  const q = vi.fn().mockResolvedValueOnce({ rows: [{ author_id: A, audience: 'all' }] })
    .mockResolvedValueOnce({ rows: [{ author_id, author_hash: '동일한_합성_hash' }] })
  vi.mocked(transaction).mockImplementation(async fn => fn({ query: q } as never))
  expect((await remove(request(), cctx)).status).toBe(403); expect(q).toHaveBeenCalledTimes(2)
})
it('댓글 본인 삭제는 서버 집계 200을 반환하고 소유자 정보는 응답하지 않는다', async () => {
  const q = vi.fn().mockResolvedValueOnce({ rows: [{ author_id: B, audience: 'all' }] })
    .mockResolvedValueOnce({ rows: [{ author_id: A }] }).mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ total: 200 }] })
  vi.mocked(transaction).mockImplementation(async fn => fn({ query: q } as never))
  const response = await remove(request(), cctx)
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ deleted: true, id: commentId, total: 200 })
  expect(q.mock.calls[2][1]).toEqual([commentId, id, A])
})
