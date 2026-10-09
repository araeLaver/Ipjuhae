import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/db', () => ({ query: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/components/layout/header', () => ({ Header: () => null }))
vi.mock('@/components/tester-banner', () => ({ TesterBanner: () => null }))
vi.mock('@/components/policy-news', () => ({ PolicyNews: () => null }))

import HomePage from '@/app/page'
import { getHomeContent, type HomePost } from '@/lib/home-content'
import { query } from '@/lib/db'
import { logger } from '@/lib/logger'

const post: HomePost = {
  id: 'question-1', title: '보증금 반환 질문', body: '질문 본문',
  comment_count: 2, view_count: 3, created_at: '2026-09-28', author_role: 'member',
}

beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function expectFailure(html: string) {
  expect(html).toContain('질문을 불러오지 못했습니다')
  expect(html).toMatch(/href="\/community"[^>]*>게시판으로 이동/)
  expect(html).not.toContain('아직 올라온 질문이 없습니다')
  expect(html).not.toContain('처음 물어보시는 분')
  expect(html).not.toContain('질문 남기기')
  expect(html).toContain('보증금 점검하기')
  expect(html).toContain('제도 전체 보기')
}

describe('홈 질문 조회 상태', () => {
  it('첫 행동은 가입 없는 점검이고 계약 대화는 이후 동선이다', async () => {
    vi.mocked(query).mockResolvedValue([])
    const html = renderToStaticMarkup(await HomePage())
    expect(html).toContain('내 보증금부터 점검하세요')
    expect(html).toContain('href="/check?from=home"')
    expect(html.indexOf('href="/check?from=home"')).toBeLessThan(html.indexOf('href="/contract-talk"'))
    expect(html).toContain('1. 시세와 보증금 입력')
  })
  it('정상 0건일 때만 첫 질문을 권한다', async () => {
    vi.mocked(query).mockResolvedValue([])
    expect((await getHomeContent()).status).toBe('success')
    const html = renderToStaticMarkup(await HomePage())
    expect(html).toContain('아직 올라온 질문이 없습니다')
    expect(html).toContain('질문 남기기')
    expect(html).not.toContain('질문을 불러오지 못했습니다')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('정상 데이터는 질문 링크와 댓글 수로 표시한다', async () => {
    vi.mocked(query).mockResolvedValue([post])
    const html = renderToStaticMarkup(await HomePage())
    expect(html).toContain('보증금 반환 질문')
    expect(html).toContain('href="/community/question-1"')
    expect(html).toContain('댓글 2')
    expect(html).not.toContain('아직 올라온 질문이 없습니다')
    expect(html).not.toContain('질문을 불러오지 못했습니다')
  })

  it('DB 예외는 오류로 전달하고 나머지 홈은 렌더링한다', async () => {
    vi.mocked(query).mockRejectedValue(new Error('database unavailable'))
    expect((await getHomeContent()).status).toBe('error')
    expectFailure(renderToStaticMarkup(await HomePage()))
    expect(logger.error).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('2.5초 초과는 오류 화면으로 끝나고 늦은 DB 실패도 처리한다', async () => {
    let rejectQuery!: (error: Error) => void
    vi.mocked(query).mockReturnValue(new Promise((_, reject) => { rejectQuery = reject }))
    const page = HomePage()
    await vi.advanceTimersByTimeAsync(2500)
    expectFailure(renderToStaticMarkup(await page))
    expect(logger.error).toHaveBeenCalled()
    rejectQuery(new Error('late failure'))
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
