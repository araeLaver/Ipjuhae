// @vitest-environment jsdom
/**
 * 커뮤니티 글 상세 화면 회귀 테스트 (DOW-1158 D3·D4·U1·U2).
 *
 * 네 결함 모두 "화면에 무엇이 보이는가"가 판정 기준이다. 소스에 특정 함수가 있는지
 * 보지 않고 실제로 렌더해서 사용자가 읽는 글자를 확인한다.
 *
 * - D3: 403에서 로그인으로 돌아갈 길이 없었고, 있던 분기(401)의 주소도 `//<id>`라 틀렸다.
 * - D4: 댓글 조회 실패가 "댓글 0"으로 보였다.
 * - U1: 서버가 내려주는 `author_role`·`is_author`를 UI가 버려서 운영자 답을 구분할 수 없었다.
 * - U2: 신고가 `window.prompt`/`alert`으로 처리됐다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { toastError, toastSuccess, routerPush } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess, message: vi.fn() },
  Toaster: () => null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/community/post-1',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/layout/header', () => ({ Header: () => null }))

import { CommunityPostView } from '@/components/community/community-post-view'

const POST_ID = 'post-1'

interface Scenario {
  user: { userType: string } | null
  postStatus: number
  post?: Record<string, unknown>
  commentsStatus: number
  comments?: unknown[]
  reportResponse?: { status: number; payload: unknown }
}

let reportBody: Record<string, unknown> | null = null

function basePost(overrides: Record<string, unknown> = {}) {
  return {
    id: POST_ID,
    audience: 'all',
    title: '보증금 못 받은 이야기',
    body: '본문입니다',
    view_count: 3,
    comment_count: 7,
    created_at: '2026-09-20T00:00:00.000Z',
    author_name: null,
    author_role: 'guest',
    is_author: false,
    ...overrides,
  }
}

function mockApi(s: Scenario) {
  reportBody = null
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('/api/auth/me')) {
        return s.user
          ? new Response(JSON.stringify({ user: s.user }), { status: 200 })
          : new Response('{}', { status: 401 })
      }
      if (url.startsWith('/api/community/reports')) {
        reportBody = JSON.parse(String(init?.body))
        const r = s.reportResponse ?? { status: 201, payload: { hidden: false } }
        return new Response(JSON.stringify(r.payload), { status: r.status })
      }
      if (url.includes('/comments')) {
        return new Response(
          JSON.stringify(s.commentsStatus === 200 ? { comments: s.comments ?? [] } : { error: '댓글을 불러오지 못했습니다' }),
          { status: s.commentsStatus },
        )
      }
      if (url.startsWith(`/api/community/posts/${POST_ID}`)) {
        return new Response(
          JSON.stringify(
            s.postStatus === 200 ? { post: s.post ?? basePost() } : { error: '접근할 수 없는 게시글입니다' },
          ),
          { status: s.postStatus },
        )
      }
      throw new Error(`예상하지 못한 요청: ${url}`)
    }),
  )
}

function renderView() {
  return render(<CommunityPostView id={POST_ID} />)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('D3 — 403에서 나갈 길', () => {
  it('비로그인 사용자에게 그 글로 돌아오는 로그인 링크를 준다', async () => {
    mockApi({ user: null, postStatus: 403, commentsStatus: 200 })
    renderView()

    const link = await screen.findByRole('link', { name: '로그인하고 이어서 보기' })

    // `//post-1`은 경로가 아니라 프로토콜 상대 URL(호스트)로 해석된다. 이게 원래 결함이었다.
    expect(link.getAttribute('href')).toBe(`/login?redirect=${encodeURIComponent(`/community/${POST_ID}`)}`)
    expect(link.getAttribute('href')).not.toContain('=//')
  })

  it('로그인했는데 역할이 다르면 로그인 링크 대신 돌아가기를 준다 — 막다른 길을 만들지 않는다', async () => {
    mockApi({ user: { userType: 'tenant' }, postStatus: 403, commentsStatus: 200 })
    renderView()

    await screen.findByRole('link', { name: '커뮤니티로 돌아가기' })
    expect(screen.queryByRole('link', { name: '로그인하고 이어서 보기' })).toBeNull()
  })
})

describe('D4 — 댓글 조회 실패', () => {
  it('실패를 "댓글 0"으로 보여주지 않는다', async () => {
    mockApi({ user: null, postStatus: 200, commentsStatus: 500 })
    renderView()

    await screen.findByText('댓글을 불러오지 못했습니다.')
    expect(screen.queryByText('댓글 0')).toBeNull()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('성공하면 실제로 그려진 댓글 수를 머리글에 쓴다', async () => {
    mockApi({
      user: null,
      postStatus: 200,
      // 서버의 comment_count는 7이지만 삭제·숨김에서 줄지 않아 실제 목록과 어긋난다.
      post: basePost({ comment_count: 7 }),
      commentsStatus: 200,
      comments: [
        { id: 'c1', body: '첫 댓글', created_at: '2026-09-21T00:00:00.000Z', author_name: null, author_role: 'guest' },
        { id: 'c2', body: '둘째 댓글', created_at: '2026-09-21T01:00:00.000Z', author_name: null, author_role: 'guest' },
      ],
    })
    renderView()

    await screen.findByText('댓글 2')
  })
})

describe('U1 — 운영자 답 구분', () => {
  it('운영자 댓글에 목록 화면과 같은 배지를 붙인다', async () => {
    mockApi({
      user: null,
      postStatus: 200,
      commentsStatus: 200,
      comments: [
        { id: 'c1', body: '옆 사람 추측', created_at: '2026-09-21T00:00:00.000Z', author_name: null, author_role: 'guest' },
        { id: 'c2', body: '운영자 답변입니다', created_at: '2026-09-21T01:00:00.000Z', author_name: '입주해', author_role: 'admin' },
      ],
    })
    renderView()

    // ROLE_LABELS.admin = '운영자'. 목록 화면(roleLabel)과 같은 표기여야 한다.
    const badge = await screen.findByText('운영자')
    expect(badge.className).toContain('bg-primary')
  })

  it('운영자 답 묶음을 배지 말고도 알아볼 수 있게 한다 — 훑는 눈에 걸려야 한다', async () => {
    mockApi({
      user: null,
      postStatus: 200,
      commentsStatus: 200,
      comments: [
        { id: 'c1', body: '옆 사람 추측', created_at: '2026-09-21T00:00:00.000Z', author_name: null, author_role: 'guest' },
        { id: 'c2', body: '운영자 답변입니다', created_at: '2026-09-21T01:00:00.000Z', author_name: '입주해', author_role: 'admin' },
      ],
    })
    renderView()

    const adminItem = (await screen.findByText('운영자 답변입니다')).closest('li')!
    const plainItem = screen.getByText('옆 사람 추측').closest('li')!

    // 운영자 쪽만 달라진다. 일반 댓글은 원래 모습 그대로여야 한다 — 질문한 사람을 낮추지 않는다.
    expect(adminItem.className).not.toBe(plainItem.className)
    expect(plainItem.className).toBe('rounded-lg border bg-background p-3')
  })

  it('모르는 author_role이 와도 배지를 만들지 않고 화면도 깨지지 않는다', async () => {
    mockApi({
      user: null,
      postStatus: 200,
      // 서버가 user_type을 늘리면(예: 'agency') UI가 모르는 값이 그대로 내려온다.
      post: basePost({ author_role: 'agency', author_name: '모르는역할' }),
      commentsStatus: 200,
      comments: [
        { id: 'c1', body: '모르는 역할의 댓글', created_at: '2026-09-21T00:00:00.000Z', author_name: null, author_role: 'agency' },
        { id: 'c2', body: '역할이 빈 댓글', created_at: '2026-09-21T01:00:00.000Z', author_name: null, author_role: null },
      ],
    })
    renderView()

    // 본문과 댓글은 그대로 보인다. 모르는 값을 날것으로 찍지도 않는다.
    await screen.findByText('본문입니다')
    screen.getByText('모르는 역할의 댓글')
    screen.getByText('역할이 빈 댓글')
    expect(screen.queryByText('agency')).toBeNull()

    // 모르는 역할은 운영자 취급도 받지 않는다.
    const unknownItem = screen.getByText('모르는 역할의 댓글').closest('li')!
    expect(unknownItem.className).toBe('rounded-lg border bg-background p-3')
  })

  it('본인 글이면 내 글 표시를 하고 신고 버튼을 세우지 않는다', async () => {
    mockApi({ user: { userType: 'tenant' }, postStatus: 200, post: basePost({ is_author: true }), commentsStatus: 200 })
    renderView()

    await screen.findByText('내 글')
    expect(screen.queryByRole('button', { name: '신고' })).toBeNull()
  })
})

describe('U2 — 신고 UI', () => {
  it('브라우저 기본 prompt/alert을 쓰지 않고 화면 안에서 사유를 받는다', async () => {
    const promptSpy = vi.fn()
    const alertSpy = vi.fn()
    vi.stubGlobal('prompt', promptSpy)
    vi.stubGlobal('alert', alertSpy)
    mockApi({ user: null, postStatus: 200, commentsStatus: 200 })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: '신고' }))
    fireEvent.click(screen.getByRole('button', { name: '광고·스팸' }))
    fireEvent.click(screen.getByRole('button', { name: '신고 접수' }))

    await waitFor(() => expect(reportBody).toEqual({ postId: POST_ID, reason: '광고·스팸' }))
    expect(promptSpy).not.toHaveBeenCalled()
    expect(alertSpy).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('신고가 접수됐습니다. 운영자가 확인합니다.')
  })

  /**
   * DOW-1161 패턴 D-2. 이전 동작은 `toast.success` 직후 `router.push('/')`였다.
   * 3초짜리 토스트와 화면 전환이 겹쳐 사용자는 둘 중 하나를 놓쳤고, 신고를 눌렀을 뿐인데
   * 화면이 설명 없이 바뀌었다. 자동 이동을 없애고 이유를 말하는 결과 화면으로 바꾼다.
   */
  it('숨김 처리돼도 자동으로 이동하지 않고, 왜 사라졌는지 말한 뒤 이동은 버튼으로 받는다', async () => {
    mockApi({
      user: null,
      postStatus: 200,
      commentsStatus: 200,
      reportResponse: { status: 201, payload: { hidden: true } },
    })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: '신고' }))
    fireEvent.click(screen.getByRole('button', { name: '욕설·혐오' }))
    fireEvent.click(screen.getByRole('button', { name: '신고 접수' }))

    await screen.findByText('신고가 접수돼 이 글은 보이지 않게 됐습니다')
    expect(toastSuccess).toHaveBeenCalledWith(
      '신고가 접수됐습니다. 신고가 쌓여 이 글은 보이지 않게 처리됐습니다.',
    )
    // 보던 글은 치운다 — 숨겨졌다고 말해 놓고 그대로 두면 말과 화면이 다르다.
    expect(screen.queryByText('본문입니다')).toBeNull()
    // 이동은 사용자가 누를 때만.
    expect(routerPush).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '커뮤니티로 돌아가기' }))
    expect(routerPush).toHaveBeenCalledWith('/')
  })

  it('접수 실패는 toast로 알린다', async () => {
    mockApi({
      user: null,
      postStatus: 200,
      commentsStatus: 200,
      reportResponse: { status: 429, payload: { error: '잠시 후 다시 시도해주세요' } },
    })
    renderView()

    fireEvent.click(await screen.findByRole('button', { name: '신고' }))
    fireEvent.click(screen.getByRole('button', { name: '허위 정보' }))
    fireEvent.click(screen.getByRole('button', { name: '신고 접수' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('잠시 후 다시 시도해주세요'))
    expect(routerPush).not.toHaveBeenCalled()
  })
})
