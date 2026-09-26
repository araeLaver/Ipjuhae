// @vitest-environment jsdom
/**
 * 커뮤니티 게시판 목록 조회 실패 회귀 테스트 (DOW-1166 웹 대응분).
 *
 * 결함이었던 것: `/api/community/posts`가 500을 내도 `setPosts(data.posts ?? [])`가
 * 빈 배열로 삼켜서, 화면에는 **"아직 질문이 없어요"**가 떴다. 사용자는 글이 없는
 * 게시판으로 읽고 떠나고, 우리는 장애가 난 줄 모른다.
 *
 * 그래서 판정 기준은 "state에 loadFailed가 있는가"가 아니다. 실패를 주입한 뒤
 * **사용자가 실제로 읽는 문구**가 빈 상태인지 실패 상태인지를 본다.
 * 성공+0건 대조군을 같이 둬서, 실패 문구가 늘 뜨는 것으로 통과하지 않게 막는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
  Toaster: () => null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/layout/header', () => ({
  Header: () => null,
}))

import { CommunityBoard } from '@/components/community/community-board'

const EMPTY_TEXT = '아직 질문이 없어요'
const FAILED_TEXT = '글 목록을 불러오지 못했습니다'

type ListResult =
  | { kind: 'ok'; posts: unknown[] }
  | { kind: 'status'; status: number }
  | { kind: 'throw' }

/** 목록 요청마다 무엇을 돌려줄지. 앞에서부터 하나씩 꺼내고, 마지막 값은 계속 재사용한다. */
let listQueue: ListResult[]
let listCalls: number

function mockApi(user: { userType: string } | null) {
  listCalls = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith('/api/auth/me')) {
        return user
          ? new Response(JSON.stringify({ user }), { status: 200 })
          : new Response('{}', { status: 401 })
      }
      if (url.startsWith('/api/community/posts')) {
        const next = listQueue.length > 1 ? listQueue.shift()! : listQueue[0]
        listCalls += 1
        if (next.kind === 'throw') throw new TypeError('Failed to fetch')
        if (next.kind === 'status') {
          return new Response(JSON.stringify({ error: 'boom' }), { status: next.status })
        }
        return new Response(JSON.stringify({ posts: next.posts }), { status: 200 })
      }
      throw new Error(`예상하지 못한 요청: ${url}`)
    }),
  )
}

function renderBoard(queue: ListResult[], user: { userType: string } | null = null) {
  listQueue = [...queue]
  mockApi(user)
  render(<CommunityBoard />)
}

const post = (id: string, title: string) => ({
  id,
  title,
  body: '본문입니다',
  audience: 'all',
  author_role: null,
  category: null,
  created_at: '2026-09-25T00:00:00.000Z',
  comment_count: 0,
})

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('목록 조회 실패를 빈 게시판으로 위장하지 않는다', () => {
  for (const status of [401, 500, 503]) {
    it(`${status} 응답이면 실패 문구를 보여주고 "${EMPTY_TEXT}"는 쓰지 않는다`, async () => {
      renderBoard([{ kind: 'status', status }])

      await waitFor(() => expect(screen.getByText(FAILED_TEXT)).toBeInTheDocument())
      expect(screen.queryByText(EMPTY_TEXT)).toBeNull()
      expect(screen.queryByRole('button', { name: /첫 글 남기기/ })).toBeNull()
    })
  }

  it('네트워크 오류로 fetch 자체가 실패해도 실패 문구를 보여준다', async () => {
    renderBoard([{ kind: 'throw' }])

    await waitFor(() => expect(screen.getByText(FAILED_TEXT)).toBeInTheDocument())
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull()
  })
})

describe('대조군 — 진짜 0건은 여전히 빈 상태다', () => {
  it('200 + posts:[] 이면 빈 상태 문구를 보여준다', async () => {
    renderBoard([{ kind: 'ok', posts: [] }])

    await waitFor(() => expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument())
    expect(screen.queryByText(FAILED_TEXT)).toBeNull()
  })

  it('글이 있으면 목록을 보여준다', async () => {
    renderBoard([{ kind: 'ok', posts: [post('p1', '보증금 돌려받는 순서가 궁금합니다')] }])

    await waitFor(() =>
      expect(screen.getByText('보증금 돌려받는 순서가 궁금합니다')).toBeInTheDocument(),
    )
    expect(screen.queryByText(FAILED_TEXT)).toBeNull()
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull()
  })
})

describe('실패는 회복 경로가 있어야 한다', () => {
  it('"다시 시도"를 누르면 재조회하고, 성공하면 목록으로 바뀐다', async () => {
    renderBoard([{ kind: 'status', status: 500 }, { kind: 'ok', posts: [post('p1', '재시도 성공 글')] }])

    await waitFor(() => expect(screen.getByText(FAILED_TEXT)).toBeInTheDocument())
    const callsBeforeRetry = listCalls

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(screen.getByText('재시도 성공 글')).toBeInTheDocument())
    expect(listCalls).toBeGreaterThan(callsBeforeRetry)
    expect(screen.queryByText(FAILED_TEXT)).toBeNull()
  })

  it('실패 뒤 탭을 바꿔 성공하면 실패 상태가 남지 않는다', async () => {
    // 탭이 둘 이상이어야 탭 전환을 눌러볼 수 있다. 비로그인은 '전체' 하나뿐이라 로그인 상태로 그린다.
    renderBoard(
      [{ kind: 'status', status: 500 }, { kind: 'ok', posts: [post('p2', '임대인 탭 글')] }],
      { userType: 'landlord' },
    )

    await waitFor(() => expect(screen.getByText(FAILED_TEXT)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '임대인' }))

    await waitFor(() => expect(screen.getByText('임대인 탭 글')).toBeInTheDocument())
    expect(screen.queryByText(FAILED_TEXT)).toBeNull()
  })
})
