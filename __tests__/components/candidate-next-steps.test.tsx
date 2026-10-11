// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CheckCandidates } from '@/components/check-candidates'
import { CANDIDATES_KEY, CHECKLIST, encodeCandidates } from '@/lib/check-candidates'
import { CANDIDATE_TASKS, checkQuestionDraft } from '@/lib/check-next-actions'
const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@/lib/analytics-client', () => ({ track }))
vi.mock('@/lib/attribution', () => ({ getAttribution: () => ({}) }))
beforeEach(() => {
  localStorage.setItem(CANDIDATES_KEY, encodeCandidates([{id:'qa',label:'비공개 후보',savedAt:'2026-10-11T00:00:00Z', input:{marketPriceManwon:40000,depositManwon:30000,mortgageMaxManwon:0,priorDepositsManwon:0},checked:[false,true,false,false]}]))
})
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks() })
it('updates the next task and restores remaining work on return without sharing candidate data', () => {
  const view=render(<CheckCandidates input={null} onLoad={vi.fn()} />)
  const region=screen.getByRole('region',{name:'이 후보의 남은 확인 사항'})
  expect(within(region).getByText('남은 확인 3개')).toBeInTheDocument()
  expect(within(region).getByText('다음 할 일: 최신 등기부 확인')).toBeInTheDocument()
  const link=within(region).getAllByRole('link')[0]
  expect(link.getAttribute('href')).toBe('/community#ask=task-register')
  fireEvent.click(link)
  expect(JSON.stringify(track.mock.calls)).not.toMatch(/비공개 후보|40000|30000/)
  fireEvent.click(screen.getByLabelText(CHECKLIST[0]))
  expect(within(region).getByText('남은 확인 2개')).toBeInTheDocument()
  expect(within(region).getByText('다음 할 일: 선순위 금액의 근거 확인')).toBeInTheDocument()
  view.unmount(); render(<CheckCandidates input={null} onLoad={vi.fn()} />)
  expect(screen.getByText('남은 확인 2개')).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText(CHECKLIST[2])); fireEvent.click(screen.getByLabelText(CHECKLIST[3]))
  expect(screen.getByText(/4개 항목을 확인했다고 기록했습니다/)).toBeInTheDocument()
  expect(screen.queryByRole('link',{name:'이 확인 항목 질문하기'})).toBeNull()
  fireEvent.click(screen.getByLabelText(CHECKLIST[1]))
  expect(screen.getByText('다음 할 일: 계약 상대와 소유자 확인')).toBeInTheDocument()
})
it('provides a fixed draft for every saved checklist task and rejects arbitrary fragments', () => {
  expect(CANDIDATE_TASKS).toHaveLength(CHECKLIST.length)
  for (const task of CANDIDATE_TASKS) {
    const draft=checkQuestionDraft(`#ask=task-${task.id}`)
    expect(draft?.body).toContain(task.action.question)
    expect(draft?.body).not.toMatch(/비공개 후보|40000|30000/)
  }
  expect(checkQuestionDraft('#ask=task-register&label=private')).toBeNull()
  expect(checkQuestionDraft('#ask=task-__proto__')).toBeNull()
})
