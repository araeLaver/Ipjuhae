import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }))
import { getCurrentUser } from '@/lib/auth'
import { queryOne, transaction } from '@/lib/db'
import { PATCH, DELETE } from '@/app/api/community/posts/[id]/route'
import { DELETE as deleteComment } from '@/app/api/community/posts/[id]/comments/[commentId]/route'
const id = '11111111-1111-4111-8111-111111111111'
const commentId = '22222222-2222-4222-8222-222222222222'
const user = { id: '33333333-3333-4333-8333-333333333333', user_type: 'tenant' } as never
const ctx = { params: Promise.resolve({ id }) }
const commentCtx = { params: Promise.resolve({ id, commentId }) }
const request = (data: unknown = { title: '합성 제목', body: '합성 본문' }) => new Request('http://localhost', { method: 'PATCH', body: JSON.stringify(data) })
const client = { query: vi.fn() }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(user)
  vi.mocked(transaction).mockImplementation(async fn => fn(client as never))
})
describe('글 소유권과 입력 검증', () => {
  it.each([PATCH, DELETE])('미인증 변경 요청 거부', async handler => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect((await handler(request(), ctx)).status).toBe(401)
    expect(queryOne).not.toHaveBeenCalled()
  })
  it.each(['other-user', null])('타인 및 비로그인 작성 글 거부: %s', async author_id => {
    vi.mocked(queryOne).mockResolvedValue({ author_id })
    expect((await PATCH(request(), ctx)).status).toBe(403)
    expect((await DELETE(request(), ctx)).status).toBe(403)
    expect(queryOne).toHaveBeenCalledTimes(2)
  })
  it('삭제/숨김 글은 변경하지 않는다', async () => {
    vi.mocked(queryOne).mockResolvedValue(null)
    expect((await PATCH(request(), ctx)).status).toBe(404)
  })
  it.each([{ title: ' ' }, { body: ' ' }, { title: 'a'.repeat(201) }, { body: 'a'.repeat(10001) }, { title: '<script>bad</script>' }, { audience: 'broker' }, { author_id: 'other' }, {}])('잘못된 입력 거부: %j', async data => {
    vi.mocked(queryOne).mockResolvedValue({ author_id: (user as { id: string }).id })
    expect((await PATCH(request(data), ctx)).status).toBe(400)
    expect(queryOne).toHaveBeenCalledTimes(1)
  })
  it('본인 수정은 정제한 서버 값을 반환하고 소유자 조건을 재검증한다', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ author_id: (user as { id: string }).id }).mockResolvedValueOnce({ id, title: '합성 제목', body: '본문' })
    const response = await PATCH(request({ title: '  합성 제목  ', body: '<b>본문</b>' }), ctx)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ post: { id, title: '합성 제목', body: '본문' } })
    expect(vi.mocked(queryOne).mock.calls[1][0]).toContain('author_id = $2 AND deleted_at IS NULL AND hidden_at IS NULL')
    expect(vi.mocked(queryOne).mock.calls[1][1]).toEqual([id, (user as { id: string }).id, '합성 제목', '본문', false, null])
  })
  it('제목 200자/본문 10000자 허용', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ author_id: (user as { id: string }).id }).mockResolvedValueOnce({ id })
    expect((await PATCH(request({ title: 'a'.repeat(200), body: 'a'.repeat(10000) }), ctx)).status).toBe(200)
  })
  it('본인 글 soft delete 및 재삭제 404', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ author_id: (user as { id: string }).id }).mockResolvedValueOnce({ id }).mockResolvedValueOnce(null)
    expect((await DELETE(request(), ctx)).status).toBe(200)
    expect(vi.mocked(queryOne).mock.calls[1][0]).toContain('deleted_at = NOW()')
    expect((await DELETE(request(), ctx)).status).toBe(404)
  })
  it('조회 이후 숨김/삭제 경쟁 시 성공하지 않는다', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ author_id: (user as { id: string }).id }).mockResolvedValueOnce(null)
    expect((await PATCH(request(), ctx)).status).toBe(404)
  })
})
describe('댓글 소유권과 공개 수', () => {
  it('미인증은 트랜잭션 실행 없이 거부', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect((await deleteComment(request(), commentCtx)).status).toBe(401)
    expect(transaction).not.toHaveBeenCalled()
  })
  it.each(['other-user', null])('타인 및 익명 댓글 거부: %s', async author_id => {
    client.query.mockResolvedValueOnce({ rows: [{ author_id: 'other', audience: 'all' }] }).mockResolvedValueOnce({ rows: [{ author_id }] })
    expect((await deleteComment(request(), commentCtx)).status).toBe(403)
    expect(client.query).toHaveBeenCalledTimes(2)
  })
  it('접근할 수 없는 역할 글의 본인 댓글도 거부', async () => {
    client.query.mockResolvedValueOnce({ rows: [{ author_id: 'other', audience: 'broker' }] })
    expect((await deleteComment(request(), commentCtx)).status).toBe(403)
    expect(client.query).toHaveBeenCalledTimes(1)
  })
  it('삭제된 부모는 댓글 삭제를 허용하지 않는다', async () => {
    client.query.mockResolvedValueOnce({ rows: [] })
    expect((await deleteComment(request(), commentCtx)).status).toBe(404)
  })
  it('다른 글에 속하거나 삭제/숨김 댓글은 404', async () => {
    client.query.mockResolvedValueOnce({ rows: [{ author_id: 'other', audience: 'all' }] }).mockResolvedValueOnce({ rows: [] })
    expect((await deleteComment(request(), commentCtx)).status).toBe(404)
    expect(client.query.mock.calls[1][1]).toEqual([commentId, id])
  })
  it('본인 댓글 soft delete 후 숨김/삭제 제외 공개 total 반환', async () => {
    client.query.mockResolvedValueOnce({ rows: [{ author_id: 'other', audience: 'all' }] })
      .mockResolvedValueOnce({ rows: [{ author_id: (user as { id: string }).id }] })
      .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: 0 }] })
    const response = await deleteComment(request(), commentCtx)
    expect(await response.json()).toEqual({ deleted: true, id: commentId, total: 0 })
    expect(client.query.mock.calls[2][0]).toContain('deleted_at = NOW()')
    expect(client.query.mock.calls[3][0]).toContain('deleted_at IS NULL AND hidden_at IS NULL')
  })
  it('DB 오류는 500', async () => {
    client.query.mockRejectedValueOnce(new Error('synthetic'))
    expect((await deleteComment(request(), commentCtx)).status).toBe(500)
  })
})
