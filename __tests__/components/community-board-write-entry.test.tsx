// @vitest-environment jsdom
/**
 * 커뮤니티 글쓰기 진입점 동작 통일 회귀 테스트 (DOW-1136).
 *
 * 결함이었던 것: 진입점 3개가 서로 다른 함수를 불러서, **어디서 열었느냐에 따라
 * 글이 다른 게시판에 올라갔다.** 카드 버튼만 역할 게시판으로 맞추고 나머지 둘은
 * 초기값 `all`에 머물렀다.
 *
 * 그래서 이 테스트는 "진입점이 같은 함수를 부르는지"를 소스에서 확인하지 않는다.
 * 진입점 3개를 각각 실제로 눌러서 **폼에 표시되는 대상 게시판 문구**를 읽는다.
 * 사용자가 실제로 보는 값을 판정 기준으로 삼아야 진입점이 또 갈라질 때 잡힌다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// vi.mock은 파일 최상단으로 끌어올려지므로 spy도 vi.hoisted로 같이 올려야 한다.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('sonner', () => ({
  toast: { error: toastError, success: vi.fn(), message: vi.fn() },
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

let alertSpy: ReturnType<typeof vi.fn>
let postBody: Record<string, unknown> | null
let postResponse: { status: number; payload: unknown }

function mockApi(user: { userType: string } | null, posts: unknown[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('/api/auth/me')) {
        return user
          ? new Response(JSON.stringify({ user }), { status: 200 })
          : new Response('{}', { status: 401 })
      }
      if (url.startsWith('/api/community/posts') && init?.method === 'POST') {
        postBody = JSON.parse(String(init.body))
        return new Response(JSON.stringify(postResponse.payload), { status: postResponse.status })
      }
      if (url.startsWith('/api/community/posts')) {
        return new Response(JSON.stringify({ posts }), { status: 200 })
      }
      throw new Error(`예상하지 못한 요청: ${url}`)
    }),
  )
}

/** 화면에 표시된 "○○ 게시판에 올라갑니다"의 대상. 폼이 닫혀 있으면 null. */
function shownTarget(): string | null {
  const el = screen.queryByText(/^\S+ 게시판$/, { selector: 'span' })
  return el?.textContent?.replace(/\s*게시판$/, '').trim() ?? null
}

/** 글쓰기 폼이 열려 있는가 — 제목 입력칸 존재 여부로 본다. */
function formOpen(): boolean {
  return screen.queryByPlaceholderText('제목') !== null
}

function click(name: RegExp | string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  postBody = null
  postResponse = { status: 400, payload: { error: '작성에 실패했습니다' } }
  toastError.mockClear()

  alertSpy = vi.fn()
  vi.stubGlobal('alert', alertSpy)
  // jsdom에는 scrollIntoView가 없다. 진입점이 이걸 부르므로 stub이 없으면 클릭이 터진다.
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** 로그인 판정(`/api/auth/me`)이 끝나 화면이 그려질 때까지 기다린다. */
async function renderBoard(user: { userType: string } | null, posts: unknown[] = []) {
  mockApi(user, posts)
  render(<CommunityBoard />)
  await waitFor(() => expect(screen.getByRole('button', { name: /^글쓰기$/ })).toBeInTheDocument())
  // 비어 있는 목록 상태(빈 상태 버튼)가 확정될 때까지 기다린다.
  await waitFor(() => expect(screen.getByRole('button', { name: /첫 글 남기기/ })).toBeInTheDocument())
}

describe('진입점 3개가 같은 대상 게시판을 연다', () => {
  const entryPoints = [
    { name: '카드 안 "지금 막히는 게 무엇인가요"', label: /지금 막히는 게 무엇인가요/ },
    { name: '목록 상단 "글쓰기"', label: /^글쓰기$/ },
    { name: '빈 상태 "첫 글 남기기"', label: /첫 글 남기기/ },
  ]

  for (const entry of entryPoints) {
    it(`${entry.name} — 임대인이 all 탭에서 열면 임대인 게시판`, async () => {
      await renderBoard({ userType: 'landlord' })

      click(entry.label)

      expect(formOpen()).toBe(true)
      expect(shownTarget()).toBe('임대인')
    })

    it(`${entry.name} — 비로그인이 열면 전체 게시판`, async () => {
      await renderBoard(null)

      click(entry.label)

      expect(formOpen()).toBe(true)
      expect(shownTarget()).toBe('전체')
    })
  }
})

describe('대상 게시판 기본값 규칙', () => {
  it('보고 있는 탭을 따른다 — 임대인 탭에서 열면 임대인 게시판', async () => {
    await renderBoard({ userType: 'landlord' })

    click('임대인')
    click(/^글쓰기$/)

    expect(shownTarget()).toBe('임대인')
  })

  it('탭이 all이면 로그인 사용자는 본인 역할 게시판', async () => {
    await renderBoard({ userType: 'tenant' })

    click(/^글쓰기$/)

    expect(shownTarget()).toBe('임차인')
  })

  it('탭이 all이면 비로그인 사용자는 전체 게시판', async () => {
    await renderBoard(null)

    click(/^글쓰기$/)

    expect(shownTarget()).toBe('전체')
  })

  it('폼이 열린 동안 탭을 바꾸면 대상도 따라간다', async () => {
    await renderBoard({ userType: 'landlord' })

    click(/^글쓰기$/)
    expect(shownTarget()).toBe('임대인')

    click('임대인') // all -> 임대인 탭
    await waitFor(() => expect(shownTarget()).toBe('임대인'))

    click('전체') // 임대인 -> all 탭. 로그인 사용자라 다시 본인 역할 게시판
    await waitFor(() => expect(shownTarget()).toBe('임대인'))
  })

  it('사용자가 대상을 직접 고른 뒤에는 탭을 바꿔도 덮어쓰지 않는다', async () => {
    await renderBoard({ userType: 'landlord' })

    click(/^글쓰기$/)
    expect(shownTarget()).toBe('임대인')

    // 대상 선택 버튼으로 "전체 게시판"을 직접 고른다
    click('전체 게시판')
    expect(shownTarget()).toBe('전체')

    // 탭을 임대인으로 바꿔도 고른 선택이 유지되어야 한다
    click('임대인')
    await waitFor(() => expect(shownTarget()).toBe('전체'))
  })
})

describe('진입점은 토글이 아니라 항상 열기다', () => {
  it('폼이 열린 상태에서 글쓰기를 다시 눌러도 닫히지 않는다', async () => {
    await renderBoard({ userType: 'landlord' })

    click(/^글쓰기$/)
    expect(formOpen()).toBe(true)

    click(/^글쓰기$/)
    expect(formOpen()).toBe(true)
  })

  it('닫기는 취소 버튼만 담당한다', async () => {
    await renderBoard({ userType: 'landlord' })

    click(/^글쓰기$/)
    click('취소')

    expect(formOpen()).toBe(false)
  })
})

describe('비로그인 사용자도 어디에 올라가는지 본다', () => {
  it('대상 선택 버튼은 없어도 대상 문구는 렌더된다', async () => {
    await renderBoard(null)

    click(/^글쓰기$/)

    // 선택 버튼(권한 있는 사용자 전용)은 없다
    expect(screen.queryByRole('button', { name: '전체 게시판' })).toBeNull()
    // 그래도 어디에 올라가는지는 보인다
    expect(screen.getByText(/에 올라갑니다/)).toBeInTheDocument()
    expect(shownTarget()).toBe('전체')
  })
})

describe('작성 실패는 alert이 아니라 toast로 알린다', () => {
  async function fillAndSubmit() {
    fireEvent.change(screen.getByPlaceholderText('제목'), { target: { value: '보증금 질문' } })
    fireEvent.change(screen.getByPlaceholderText(/어떤 상황인지/), { target: { value: '내용입니다' } })
    click('올리기')
  }

  it('실패 응답에서 alert을 부르지 않는다', async () => {
    postResponse = { status: 400, payload: { error: '본문이 너무 짧습니다' } }
    await renderBoard({ userType: 'tenant' })

    click(/^글쓰기$/)
    await fillAndSubmit()

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('본문이 너무 짧습니다'))
    expect(alertSpy).not.toHaveBeenCalled()
    expect(formOpen()).toBe(true)
  })

  it('성공하면 폼이 닫히고 선택한 게시판으로 전송된다', async () => {
    postResponse = { status: 200, payload: { id: 'p1' } }
    await renderBoard({ userType: 'tenant' })

    click(/^글쓰기$/)
    await fillAndSubmit()

    await waitFor(() => expect(formOpen()).toBe(false))
    expect(postBody).toMatchObject({ audience: 'tenant', title: '보증금 질문' })
    expect(alertSpy).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })
})
