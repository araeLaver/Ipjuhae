// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { CandidateBackup } from '@/components/candidate-backup'
import { CANDIDATES_KEY, encodeCandidates } from '@/lib/check-candidates'
import { candidateSummary } from '@/lib/candidate-summary'
const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@/lib/analytics-client', () => ({ track }))
vi.mock('@/lib/attribution', () => ({ getAttribution: () => ({}) }))
const item = {
  id: 'qa',
  label: '후보 A',
  savedAt: '2026-10-11T14:00:00Z',
  input: {
    marketPriceManwon: 40000,
    depositManwon: 30000,
    mortgageMaxManwon: 0,
    priorDepositsManwon: 0,
  },
  checked: [true, false, false, false],
}
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})
it('exports entered facts and remaining checks without inventing verified safety', () => {
  const text = candidateSummary([item])
  expect(text).toContain('후보 A')
  expect(text).toContain('[본인 확인] 최신 등기부')
  expect(text).toContain('[남은 확인] 계약 상대')
  expect(text).toContain('보장하지 않습니다')
})
it('rejects corrupt backups and requires confirmation before replacing valid candidates', async () => {
  const existing = encodeCandidates([{ ...item, label: '현재 후보' }])
  localStorage.setItem(CANDIDATES_KEY, existing)
  const restored = vi.fn()
  render(<CandidateBackup items={[item]} onRestored={restored} />)
  fireEvent.change(screen.getByLabelText('후보 백업 파일 선택'), {
    target: { files: [{ size: 10, text: async () => 'broken' }] },
  })
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      '기존 후보는 변경하지 않았습니다',
    ),
  )
  expect(localStorage.getItem(CANDIDATES_KEY)).toBe(existing)
  fireEvent.change(screen.getByLabelText('후보 백업 파일 선택'), {
    target: {
      files: [{ size: 500, text: async () => encodeCandidates([item]) }],
    },
  })
  await screen.findByRole('button', { name: '기존 후보를 교체하고 복원' })
  expect(localStorage.getItem(CANDIDATES_KEY)).toBe(existing)
  fireEvent.click(
    screen.getByRole('button', { name: '기존 후보를 교체하고 복원' }),
  )
  expect(localStorage.getItem(CANDIDATES_KEY)).toBe(encodeCandidates([item]))
  expect(restored).toHaveBeenCalledOnce()
  expect(track).toHaveBeenCalledWith('check_backup_restored', {
    properties: { surface: 'web' },
  })
  expect(JSON.stringify(track.mock.calls)).not.toMatch(/후보 A|40000|30000/)
})
