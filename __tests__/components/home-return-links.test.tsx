// @vitest-environment jsdom
import { cleanup, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { HomeReturnLinks } from '@/components/home-return-links'
import { CANDIDATES_KEY } from '@/lib/check-candidates'
import { QUESTION_KEY } from '@/lib/community-follow-up'

const candidate = {
  id: 'home-1',
  label: '개인 후보 이름',
  savedAt: '2026-10-11T00:00:00Z',
  input: {
    marketPriceManwon: 40000,
    depositManwon: 30000,
    mortgageMaxManwon: 0,
    priorDepositsManwon: 0,
  },
  checked: [true, false, false, false],
}
const question = '11111111-1111-4111-8111-111111111111'
beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('offers useful return links before any progress has been saved', () => {
  render(<HomeReturnLinks />)
  expect(
    screen
      .getByRole('link', { name: /저장한 후보 이어보기/ })
      .getAttribute('href'),
  ).toBe('/check#candidates')
  expect(
    screen
      .getByRole('link', { name: /내 질문 답변 확인/ })
      .getAttribute('href'),
  ).toBe('/community#follow-up')
})

it('shows local progress counts without exposing inputs, names or question identifiers', () => {
  localStorage.setItem(
    CANDIDATES_KEY,
    JSON.stringify({ version: 1, items: [candidate] }),
  )
  localStorage.setItem(QUESTION_KEY, JSON.stringify([question]))
  const view = render(<HomeReturnLinks />)
  expect(
    screen.getByRole('link', { name: /내 후보 1개 · 남은 확인 3개/ }),
  ).toBeTruthy()
  expect(
    screen.getByRole('link', { name: /보관한 질문 1개 · 답변 확인/ }),
  ).toBeTruthy()
  expect(view.container.textContent).not.toContain('개인 후보 이름')
  expect(view.container.innerHTML).not.toMatch(/40000|30000|11111111/)
})

it('recovers when another tab changes or clears the local records', () => {
  render(<HomeReturnLinks />)
  act(() => {
    localStorage.setItem(
      CANDIDATES_KEY,
      JSON.stringify({ version: 1, items: [candidate] }),
    )
    window.dispatchEvent(new StorageEvent('storage', { key: CANDIDATES_KEY }))
  })
  expect(screen.getByRole('link', { name: /내 후보 1개/ })).toBeTruthy()
  act(() => {
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
  })
  expect(
    screen.getByRole('link', { name: /저장한 후보 이어보기/ }),
  ).toBeTruthy()
})

it('preserves the question return path when candidate storage is damaged', () => {
  localStorage.setItem(CANDIDATES_KEY, 'damaged')
  localStorage.setItem(QUESTION_KEY, JSON.stringify([question]))
  render(<HomeReturnLinks />)
  expect(screen.getByRole('link', { name: /보관한 질문 1개/ })).toBeTruthy()
  expect(screen.getByText(/기기 저장 내용을 읽지 못했습니다/)).toBeTruthy()
  expect(localStorage.getItem(CANDIDATES_KEY)).toBe('damaged')
})
