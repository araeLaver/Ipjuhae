// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { checkQuestionDraft, checkQuestionHref, checkNextActions } from '@/lib/check-next-actions'
vi.mock('@/components/layout/header', () => ({ Header: () => null }))
vi.mock('@/components/community/follow-up-questions', () => ({ FollowUpQuestions: () => null }))
import { CommunityBoard } from '@/components/community/community-board'
beforeEach(() => {
  window.history.replaceState({}, '', '/community#ask=check-danger')
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { fn(); return 0 })
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/auth/me') ? {} : { posts: [] }))))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); vi.restoreAllMocks() })
it('prefills an editable draft without posting or transferring calculator amounts', async () => {
  render(<CommunityBoard />)
  expect(screen.getByPlaceholderText('제목')).toHaveValue('보증금 점검 후 계약 전 확인할 내용을 질문합니다')
  const body = document.querySelector('textarea')!
  expect((body as HTMLTextAreaElement).value).toContain("'위험'")
  await waitFor(() => expect(screen.getByRole('button', { name: '올리기' })).toBeEnabled())
  expect(vi.mocked(fetch).mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true)
  fireEvent.change(screen.getByPlaceholderText('제목'), { target: { value: '직접 쓴 질문' } })
  window.history.replaceState({}, '', '/community#ask=check-safe'); window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(screen.getByPlaceholderText('제목')).toHaveValue('직접 쓴 질문')
})
it('accepts only fixed result identifiers and rejects arbitrary payloads', () => {
  for (const level of ['safe','caution','danger','critical'] as const) {
    const href=checkQuestionHref(level)
    expect(href).not.toContain('?')
    expect(checkQuestionDraft(href.slice(href.indexOf('#')))?.body).toContain('직접 적어주세요')
    expect(checkNextActions(level).every(a=>a.documents && a.contact && a.question)).toBe(true)
  }
  for (const hash of ['#ask', '#ask=check-__proto__', '#ask=check-danger&deposit=30000']) expect(checkQuestionDraft(hash)).toBeNull()
})
