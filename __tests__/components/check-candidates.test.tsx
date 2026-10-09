// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@/lib/attribution', () => ({ getAttribution: () => ({}) }))
vi.mock('@/lib/analytics-client', () => ({ track }))
import { CheckCandidates } from '@/components/check-candidates'
import { CANDIDATES_KEY, CHECKLIST, decodeCandidates } from '@/lib/check-candidates'
const input = { marketPriceManwon: 40000, depositManwon: 30000, mortgageMaxManwon: 1000, priorDepositsManwon: 0 }
beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('persists two homes and checklist across reload, compares, restores and deletes', () => {
  const load = vi.fn()
  const first = render(<CheckCandidates input={input} onLoad={load} />)
  fireEvent.change(screen.getByLabelText('후보 별칭 (선택)'), { target: { value: '집 A' } })
  fireEvent.click(screen.getByRole('button', { name: '현재 결과를 후보로 저장' }))
  fireEvent.click(screen.getByLabelText(CHECKLIST[0]))
  first.rerender(<CheckCandidates input={{ ...input, depositManwon: 20000 }} onLoad={load} />)
  fireEvent.change(screen.getByLabelText('후보 별칭 (선택)'), { target: { value: '집 B' } })
  fireEvent.click(screen.getByRole('button', { name: '현재 결과를 후보로 저장' }))
  fireEvent.click(screen.getByRole('button', { name: '후보 비교하기' }))
  expect(screen.getByRole('table')).toBeTruthy()
  expect(track).toHaveBeenCalledWith('check_comparison_viewed', { properties: { surface: 'web' } })
  expect(JSON.stringify(track.mock.calls)).not.toMatch(/집 A|40000|30000|local-/)
  first.unmount()
  render(<CheckCandidates input={null} onLoad={load} />)
  const article = screen.getByRole('heading', { name: '집 A' }).closest('article')!
  expect((within(article).getByLabelText(CHECKLIST[0]) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(within(article).getByRole('button', { name: '이 후보 다시 점검' }))
  expect(load).toHaveBeenCalledWith(input)
  fireEvent.click(screen.getByRole('button', { name: '집 A 삭제' }))
  expect(decodeCandidates(localStorage.getItem(CANDIDATES_KEY))).toHaveLength(1)
  expect(screen.queryByRole('heading', { name: '집 A' })).toBeNull()
})
it('does not report success or emit events when storage is blocked', () => {
  render(<CheckCandidates input={input} onLoad={vi.fn()} />)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
  fireEvent.click(screen.getByRole('button', { name: '현재 결과를 후보로 저장' }))
  expect(screen.getByRole('alert').textContent).toContain('저장하지 못했습니다')
  expect(track).not.toHaveBeenCalled()
  expect(screen.queryByRole('status')).toBeNull()
})
it('keeps corrupted storage intact until explicit reset confirmation', () => {
  localStorage.setItem(CANDIDATES_KEY, '{broken')
  render(<CheckCandidates input={null} onLoad={vi.fn()} />)
  expect(screen.getByRole('alert').textContent).toContain('불러오지 못했습니다')
  expect(localStorage.getItem(CANDIDATES_KEY)).toBe('{broken')
  fireEvent.click(screen.getByRole('button', { name: '저장 데이터 초기화' }))
  expect(localStorage.getItem(CANDIDATES_KEY)).toBe('{broken')
  fireEvent.click(screen.getByRole('button', { name: '모두 지우기' }))
  expect(localStorage.getItem(CANDIDATES_KEY)).toBeNull()
})
it('enforces the five-candidate limit without losing saved homes', () => {
  render(<CheckCandidates input={input} onLoad={vi.fn()} />)
  for(let i=0;i<6;i++) fireEvent.click(screen.getByRole('button', { name: '현재 결과를 후보로 저장' }))
  expect(decodeCandidates(localStorage.getItem(CANDIDATES_KEY))).toHaveLength(5)
  expect(screen.getByRole('alert').textContent).toContain('5개까지')
  expect(track.mock.calls.filter(call => call[0] === 'check_candidate_saved')).toHaveLength(5)
})

it('refreshes candidates when another tab clears the saved data', () => {
  render(<CheckCandidates input={input} onLoad={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '현재 결과를 후보로 저장' }))
  expect(screen.getByRole('heading', { name: '후보 1' })).toBeTruthy()
  localStorage.removeItem(CANDIDATES_KEY)
  fireEvent(window, new StorageEvent('storage', { key: CANDIDATES_KEY, newValue: null }))
  expect(screen.queryByRole('heading', { name: '후보 1' })).toBeNull()
})
