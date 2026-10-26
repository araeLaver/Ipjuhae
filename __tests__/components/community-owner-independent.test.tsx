// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('@/components/layout/header', () => ({ Header: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
const { success, push } = vi.hoisted(() => ({ success: vi.fn(), push: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success, error: vi.fn() } }))
import { CommunityPostView } from '@/components/community/community-post-view'
const post = { id: 'qa-post', audience: 'all', title: '독립 합성 제목', body: '독립 합성 본문', author_role: 'member', is_author: true, created_at: '2026-10-13', view_count: 0, comment_count: 201 }
const comment = (n: number) => ({ id: `qa-${n}`, body: `합성 댓글 ${n}`, author_role: 'member', is_author: n === 0, created_at: '2026-10-13' })
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
let mutation: () => Promise<Response>
let page: () => Promise<Response>
let auth: boolean
let own: boolean
let total: number
let cursor: string | null
let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks(); auth = true; own = true; total = 2; cursor = null
  mutation = async () => json({ deleted: true, id: 'qa-0', total: 1 })
  page = async () => json({ comments: [comment(2)], total: 202, nextCursor: null })
  fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === 'DELETE' || init?.method === 'PATCH') return mutation()
    if (input.includes('/auth/me')) return json({ user: auth ? { userType: 'tenant' } : null })
    if (input.includes('cursor=')) return page()
    if (input.includes('/comments')) return json({ comments: [comment(0), comment(1)], total, nextCursor: cursor })
    return json({ post: { ...post, is_author: own } })
  })
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
async function ready() { render(<CommunityPostView id="qa-post" />); await screen.findByText('합성 댓글 0') }
async function deleteOwn() { fireEvent.click(screen.getByRole('button', { name: '내 댓글 삭제' })); await screen.findByRole('alertdialog') }
const mutations = () => fetcher.mock.calls.filter(c => ['DELETE', 'PATCH'].includes(c[1]?.method ?? ''))
it.each([true, false])('인증 상태 %s에서 서버 본인 판정과 함께 관리 버튼을 제한한다', async signedIn => {
  auth = signedIn; await ready()
  expect(screen.queryAllByRole('button', { name: '수정' })).toHaveLength(signedIn ? 1 : 0)
  expect(screen.queryAllByRole('button', { name: '내 댓글 삭제' })).toHaveLength(signedIn ? 1 : 0)
})
it('타인 글은 수정 버튼이 없고 본인 댓글만 삭제 가능하다', async () => {
  own = false; await ready(); expect(screen.queryByRole('button', { name: '수정' })).toBeNull()
  expect(screen.getAllByRole('button', { name: '내 댓글 삭제' })).toHaveLength(1)
})
it('삭제 취소는 요청 없이 원본과 total을 유지한다', async () => {
  await ready(); await deleteOwn(); fireEvent.click(screen.getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(mutations()).toHaveLength(0); expect(screen.getByText('댓글 2')).toBeTruthy()
})
it.each([401, 403, 404, 429, 500])('댓글 삭제 HTTP %s는 원본을 유지하고 성공 안내를 하지 않는다', async status => {
  mutation = async () => json({ error: '합성 오류' }, status)
  await ready(); await deleteOwn(); fireEvent.click(screen.getByRole('button', { name: '댓글 삭제' }))
  await screen.findByRole('alert'); expect(screen.getByText('합성 댓글 0')).toBeTruthy()
  expect(screen.getByText('댓글 2')).toBeTruthy(); expect(success).not.toHaveBeenCalled()
})
it('응답 유실은 수동 확인 전 DELETE를 재전송하지 않는다', async () => {
  mutation = async () => { throw Error('합성 응답 유실') }
  await ready(); await deleteOwn(); fireEvent.click(screen.getByRole('button', { name: '댓글 삭제' }))
  await screen.findByText('삭제 결과를 확인하지 못했습니다.')
  expect(screen.getByRole('button', { name: '댓글 삭제' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '결과 다시 확인' }))
  await screen.findByText('현재 내용을 확인했습니다. 입력한 내용은 보존했습니다.')
  expect(mutations()).toHaveLength(1); expect(success).not.toHaveBeenCalled()
})
it('201개 total과 지연된 더 보기 응답에서 삭제한 댓글과 과거 total이 재등장하지 않는다', async () => {
  total = 201; cursor = 'qa-cursor'
  let resolvePage!: (r: Response) => void
  page = () => new Promise(r => { resolvePage = r })
  mutation = async () => json({ deleted: true, id: 'qa-0', total: 200 })
  await ready(); fireEvent.change(screen.getByPlaceholderText('댓글을 입력하세요'), { target: { value: '유지할 댓글 draft' } })
  fireEvent.click(screen.getByRole('button', { name: '댓글 더 보기' }))
  await deleteOwn(); fireEvent.click(screen.getByRole('button', { name: '댓글 삭제' }))
  await screen.findByText('댓글 200')
  await act(async () => resolvePage(json({ comments: [comment(0), comment(2)], total: 201, nextCursor: null })))
  expect(screen.queryByText('합성 댓글 0')).toBeNull(); expect(screen.getByText('합성 댓글 1')).toBeTruthy()
  expect(screen.getByText('댓글 200')).toBeTruthy(); expect(screen.getByPlaceholderText('댓글을 입력하세요')).toHaveValue('유지할 댓글 draft')
})
it('빠른 중복 삭제는 1회만 요청하고 요청 중 취소를 막는다', async () => {
  let resolveDelete!: (r: Response) => void
  mutation = () => new Promise(r => { resolveDelete = r })
  await ready(); await deleteOwn(); const button = screen.getByRole('button', { name: '댓글 삭제' })
  fireEvent.click(button); fireEvent.click(button)
  expect(mutations()).toHaveLength(1); expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
  await act(async () => resolveDelete(json({ deleted: true, id: 'qa-0', total: 0 })))
  await screen.findByText('댓글 0')
})
it('수정 500은 편집 draft와 댓글 입력을 보존한다', async () => {
  mutation = async () => json({}, 500); await ready()
  fireEvent.change(screen.getByPlaceholderText('댓글을 입력하세요'), { target: { value: '댓글 draft' } })
  fireEvent.click(screen.getByRole('button', { name: '수정' }))
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '수정 draft' } })
  fireEvent.click(screen.getByRole('button', { name: '수정 저장' })); await screen.findByRole('alert')
  expect(screen.getByLabelText('제목')).toHaveValue('수정 draft')
  expect(screen.getByPlaceholderText('댓글을 입력하세요')).toHaveValue('댓글 draft')
})
it('삭제 성공 계약이 없는 200 응답은 삭제 완료로 표시하지 않아야 한다', async () => {
  mutation = async () => json({}); await ready(); fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '글 삭제' }))
  await waitFor(() => expect(mutations()).toHaveLength(1))
  await act(async () => {})
  expect(screen.queryByText('글이 삭제됐습니다.')).toBeNull()
})
it('글 삭제 성공은 결과 Card와 명시적 목록 이동을 제공하고 댓글 입력을 제거한다', async () => {
  mutation = async () => json({ deleted: true, id: 'qa-post' }); await ready()
  fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '글 삭제' }))
  await screen.findByText('글이 삭제됐습니다.')
  fireEvent.click(screen.getByRole('button', { name: '커뮤니티로 돌아가기' })); expect(push).toHaveBeenCalledWith('/community')
  expect(screen.queryByPlaceholderText('댓글을 입력하세요')).toBeNull()
})
it('수정 취소 확인의 계속 수정은 draft를 보존한다', async () => {
  await ready(); fireEvent.click(screen.getByRole('button', { name: '수정' }))
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '보존할 합성 draft' } })
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  fireEvent.click(await screen.findByRole('button', { name: '계속 수정' }))
  expect(screen.getByLabelText('제목')).toHaveValue('보존할 합성 draft'); expect(mutations()).toHaveLength(0)
})
it('수정 성공은 서버 값으로 표시하고 상세 화면을 유지한다', async () => {
  mutation = async () => json({ post: { title: '서버 확정 제목', body: '서버 확정 본문' } })
  await ready(); fireEvent.click(screen.getByRole('button', { name: '수정' }))
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '입력 제목' } })
  fireEvent.click(screen.getByRole('button', { name: '수정 저장' }))
  await screen.findByRole('heading', { name: '서버 확정 제목' }); expect(screen.getByText('서버 확정 본문')).toBeTruthy()
  expect(screen.getByText('합성 댓글 1')).toBeTruthy()
})
it('댓글 삭제 성공 후 개수 확인 실패는 삭제 행을 복구하거나 0으로 표시하지 않는다', async () => {
  await ready()
  const normal = fetcher.getMockImplementation() as (input: string, init?: RequestInit) => Promise<Response>
  fetcher.mockImplementation(async (input: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') return json({ deleted: true, id: 'qa-0' })
    if (input.endsWith('/comments')) return json({}, 500)
    return normal(input, init)
  })
  await deleteOwn(); fireEvent.click(screen.getByRole('button', { name: '댓글 삭제' }))
  await screen.findByText('댓글 수를 확인하지 못했습니다.')
  expect(screen.queryByText('합성 댓글 0')).toBeNull(); expect(screen.queryByText('댓글 0')).toBeNull()
  expect(screen.getByText('합성 댓글 1')).toBeTruthy()
})
it.each([{}, { deleted: true, id: '다른-댓글' }, { deleted: 'true', id: 'qa-0' }, null])('별도 댓글 계약 불일치 %j는 행과 total을 유지한다', async payload => {
  mutation = async () => json(payload); await ready(); await deleteOwn()
  fireEvent.click(screen.getByRole('button', { name: '댓글 삭제' }))
  await screen.findByText('삭제 결과를 확인하지 못했습니다.')
  expect(screen.getByText('합성 댓글 0')).toBeTruthy(); expect(screen.getByText('댓글 2')).toBeTruthy()
  expect(success).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: '댓글 삭제' })).toBeDisabled()
})
it('삭제 dialog 초기 취소 초점과 Escape 종료는 요청 없이 원본을 유지한다', async () => {
  await ready(); await deleteOwn()
  await waitFor(() => expect(screen.getByRole('button', { name: '취소' })).toHaveFocus())
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape', code: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(mutations()).toHaveLength(0); expect(screen.getByText('합성 댓글 0')).toBeTruthy()
  await waitFor(() => expect(screen.getByRole('button', { name: '내 댓글 삭제' })).toHaveFocus())
})
