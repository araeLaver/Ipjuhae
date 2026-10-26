// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const { push, success } = vi.hoisted(() => ({ push: vi.fn(), success: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success, error: vi.fn() } }))
vi.mock('@/components/layout/header', () => ({ Header: () => null }))
import { CommunityPostView } from '@/components/community/community-post-view'
const post = { id: 'p1', audience: 'all', title: '합성 제목', body: '합성 본문', is_author: true, author_role: 'member', comment_count: 2 }
const comments = [{ id: 'c1', body: '내 댓글 본문', is_author: true, author_role: 'member' }, { id: 'c2', body: '타인 댓글 본문', is_author: false, author_role: 'member' }]
let authenticated = true
let author = true
let status = 200
let rejectNetwork = false
let hold: Promise<Response> | null = null
let more: Promise<Response> | null = null
let paginated = false
let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  authenticated = true; author = true; status = 200; rejectNetwork = false; hold = null; more = null; paginated = false
  success.mockClear(); push.mockClear()
  fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === '/api/auth/me') return Response.json(authenticated ? { user: { userType: 'tenant' } } : {}, { status: authenticated ? 200 : 401 })
    if (init?.method === 'PATCH' || init?.method === 'DELETE') {
      if (hold) return hold
      if (rejectNetwork) throw new Error('network')
      if (status !== 200) return Response.json({ error: '합성 오류' }, { status })
      if (init.method === 'PATCH') return Response.json({ post: { ...JSON.parse(String(init.body)), title: '서버 제목' } })
      return Response.json({ deleted: true, id: input.endsWith('/comments/c1') ? 'c1' : 'p1', total: 1 })
    }
    if (input.includes('cursor=') && more) return more
    if (input.includes('/comments')) return Response.json({ comments: comments.map(c => ({ ...c, is_author: author && c.is_author })), total: 2, nextCursor: paginated ? 'cursor' : null })
    return Response.json({ post: { ...post, is_author: author } })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const open = async () => { render(<CommunityPostView id="p1" />); await screen.findByText('합성 제목'); await screen.findByText('타인 댓글 본문') }
const mutations = () => fetchMock.mock.calls.filter(([, init]) => ['PATCH', 'DELETE'].includes(init?.method))
it('인증된 본인 글과 댓글만 관리 버튼 노출', async () => {
  await open()
  expect(screen.getByRole('button', { name: '수정' })).toBeVisible()
  expect(screen.getAllByRole('button', { name: '내 댓글 삭제' })).toHaveLength(1)
})
it.each(['guest', 'other'])('비로그인/타인에게 소유권 버튼 없음: %s', async mode => {
  authenticated = mode !== 'guest'; author = mode === 'guest'
  await open()
  expect(screen.queryByRole('button', { name: '수정' })).toBeNull()
  expect(screen.queryByRole('button', { name: '내 댓글 삭제' })).toBeNull()
})
it('수정 성공은 서버 값을 반영하고 댓글 입력 보존', async () => {
  await open()
  fireEvent.change(screen.getByPlaceholderText('댓글을 입력하세요'), { target: { value: '입력 중 댓글' } })
  fireEvent.click(screen.getByRole('button', { name: '수정' }))
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '수정 제목' } })
  fireEvent.click(screen.getByRole('button', { name: '수정 저장' }))
  await screen.findByText('서버 제목')
  expect(screen.getByPlaceholderText('댓글을 입력하세요')).toHaveValue('입력 중 댓글')
  expect(success).toHaveBeenCalledWith('글이 수정됐습니다.')
  expect(push).not.toHaveBeenCalled()
})
it('빈 제목 검증과 실패 시 draft 유지', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '수정' }))
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: ' ' } })
  fireEvent.click(screen.getByRole('button', { name: '수정 저장' }))
  expect(await screen.findByText('제목을 입력해주세요.')).toBeVisible()
  expect(mutations()).toHaveLength(0)
  status = 500
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: 'draft' } })
  fireEvent.click(screen.getByRole('button', { name: '수정 저장' }))
  await screen.findByText('글을 저장하지 못했습니다. 입력한 내용은 그대로 있습니다. 다시 시도해주세요.')
  expect(screen.getByLabelText('제목')).toHaveValue('draft')
})
it('변경 취소는 확인 후에만 draft를 버린다', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '수정' }))
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: 'draft' } })
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  await screen.findByText('수정을 취소할까요?')
  fireEvent.click(screen.getByRole('button', { name: '계속 수정' }))
  expect(screen.getByLabelText('제목')).toHaveValue('draft')
})
it('글 삭제 취소는 요청 없이 원본 유지', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  await screen.findByText('글을 삭제할까요?')
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(mutations()).toHaveLength(0)
  expect(screen.getByText('합성 제목')).toBeVisible()
})
it('글 삭제 성공은 결과 화면과 명시적 목록 이동', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '글 삭제' }))
  await screen.findByText('글이 삭제됐습니다.')
  expect(screen.queryByText('내 댓글 본문')).toBeNull()
  expect(push).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '커뮤니티로 돌아가기' }))
  expect(push).toHaveBeenCalledWith('/community')
})
it('댓글 삭제 성공은 행 제거와 서버 total 반영', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: '내 댓글 삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '댓글 삭제' }))
  await waitFor(() => expect(screen.queryByText('내 댓글 본문')).toBeNull())
  expect(screen.getByText('타인 댓글 본문')).toBeVisible()
  expect(screen.getByText('댓글 1')).toBeVisible()
})
it('삭제 실패는 원본과 total 유지', async () => {
  status = 500; await open(); fireEvent.click(screen.getByRole('button', { name: '내 댓글 삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '댓글 삭제' }))
  await screen.findByText('삭제하지 못했습니다. 다시 시도해주세요.')
  expect(screen.getByText('내 댓글 본문')).toBeVisible()
  expect(screen.getByText('댓글 2')).toBeVisible()
})
it('빠른 중복 삭제를 막고 응답 대기 중 취소 불가', async () => {
  let resolve!: (response: Response) => void
  hold = new Promise(r => { resolve = r })
  await open(); fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  const button = await screen.findByRole('button', { name: '글 삭제' })
  fireEvent.click(button); fireEvent.click(button)
  expect(mutations()).toHaveLength(1)
  expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
  resolve(Response.json({ deleted: true, id: 'p1' }))
  await screen.findByText('글이 삭제됐습니다.')
})
it('응답 유실은 자동 재시도 없이 결과 확인 제공', async () => {
  rejectNetwork = true; await open(); fireEvent.click(screen.getByRole('button', { name: '내 댓글 삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '댓글 삭제' }))
  await screen.findByText('삭제 결과를 확인하지 못했습니다.')
  expect(screen.getByRole('button', { name: '댓글 삭제' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '결과 다시 확인' })).toBeVisible()
  expect(mutations()).toHaveLength(1)
})
it('오래된 더 보기 응답은 삭제된 댓글과 total을 되돌리지 않는다', async () => {
  paginated = true
  let resolve!: (response: Response) => void
  more = new Promise(r => { resolve = r })
  await open(); fireEvent.click(screen.getByRole('button', { name: '댓글 더 보기' }))
  fireEvent.click(screen.getByRole('button', { name: '내 댓글 삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '댓글 삭제' }))
  await waitFor(() => expect(screen.queryByText('내 댓글 본문')).toBeNull())
  resolve(Response.json({ comments, total: 2, nextCursor: null }))
  await waitFor(() => expect(screen.getByRole('button', { name: '댓글 더 보기' })).toBeEnabled())
  expect(screen.queryByText('내 댓글 본문')).toBeNull()
  expect(screen.getByText('댓글 1')).toBeVisible()
})

it.each([401,403,404,429])('변경 실패 상태를 구분하고 입력을 보존: %s', async code => {
  status = code; await open(); fireEvent.click(screen.getByRole('button', {name:'수정'}))
  fireEvent.change(screen.getByLabelText('제목'), {target:{value:'보존 draft'}})
  fireEvent.click(screen.getByRole('button', {name:'수정 저장'}))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('제목')).toHaveValue('보존 draft')
  expect(success).not.toHaveBeenCalled()
  if (code === 401) expect(screen.getByRole('link',{name:'로그인하고 돌아오기'})).toHaveAttribute('href','/login?redirect=%2Fcommunity%2Fp1')
  if (code === 403 || code === 404) expect(screen.getByRole('button',{name:'글 다시 확인'})).toBeVisible()
})
it('응답 유실 후 확인에서 아직 존재하는 댓글은 제거하지 않는다', async () => {
  rejectNetwork = true; await open(); fireEvent.click(screen.getByRole('button',{name:'내 댓글 삭제'}))
  fireEvent.click(await screen.findByRole('button',{name:'댓글 삭제'}))
  fireEvent.click(await screen.findByRole('button',{name:'결과 다시 확인'}))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(screen.getByText('내 댓글 본문')).toBeVisible()
  expect(screen.getByText('댓글 2')).toBeVisible()
  expect(success).not.toHaveBeenCalled()
})

const invalidDeletes = [
  ['빈 응답', {}], ['null', null], ['배열', []], ['false', { deleted: false }],
  ['문자열 true', { deleted: 'true' }], ['ID 누락', { deleted: true }],
  ['다른 ID', { deleted: true, id: 'other', total: 0 }],
] as const
it.each(invalidDeletes)('글 삭제 계약 불일치는 원본 보존과 수동 확인: %s', async (_name, data) => {
  hold = Promise.resolve(Response.json(data))
  await open(); fireEvent.click(screen.getByRole('button', { name: '삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '글 삭제' }))
  await screen.findByText('삭제 결과를 확인하지 못했습니다.')
  expect(screen.getByText('합성 제목')).toBeVisible()
  expect(screen.queryByText('글이 삭제됐습니다.')).toBeNull()
  expect(screen.getByRole('button', { name: '글 삭제' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '결과 다시 확인' })).toBeVisible()
  expect(mutations()).toHaveLength(1); expect(success).not.toHaveBeenCalled()
})
it.each(invalidDeletes)('댓글 삭제 계약 불일치는 행과 total 보존: %s', async (_name, data) => {
  hold = Promise.resolve(Response.json(data))
  await open(); fireEvent.click(screen.getByRole('button', { name: '내 댓글 삭제' }))
  fireEvent.click(await screen.findByRole('button', { name: '댓글 삭제' }))
  await screen.findByText('삭제 결과를 확인하지 못했습니다.')
  expect(screen.getByText('내 댓글 본문')).toBeVisible()
  expect(screen.getByText('댓글 2')).toBeVisible()
  expect(screen.getByRole('button', { name: '댓글 삭제' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '결과 다시 확인' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(screen.getByText('내 댓글 본문')).toBeVisible()
  expect(screen.getByText('댓글 2')).toBeVisible()
  expect(mutations()).toHaveLength(1); expect(success).not.toHaveBeenCalled()
})
