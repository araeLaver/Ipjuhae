// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@/lib/analytics-client', () => ({ track }))
vi.mock('@/lib/attribution', () => ({ getAttribution: () => ({}) }))
vi.mock('@/components/market-price-picker', () => ({ MarketPricePicker: () => null }))
vi.mock('@/components/tester-invite', () => ({ TesterInvite: () => null }))
import { DepositRiskCheck } from '@/components/deposit-risk-check'
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('counts first input once, connects results to real next actions, and invalidates stale results', () => {
  render(<DepositRiskCheck />)
  fireEvent.change(screen.getByLabelText('매매 시세'), { target: { value: '40000' } })
  fireEvent.change(screen.getByLabelText('내 보증금'), { target: { value: '30000' } })
  expect(track.mock.calls.filter(call => call[0] === 'check_started')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '확인하기' }))
  const ask = screen.getByRole('link', { name: '등기부 내용을 질문하기' })
  expect(ask.getAttribute('href')).toBe('/community#ask=check-caution')
  expect(screen.getByRole('link', { name: '집주인과 계약 전 확인하기' }).getAttribute('href')).toBe('/contract-talk')
  expect(screen.getByRole('link', { name: /10화/ }).getAttribute('href')).toBe('/guides/deungi/10')
  fireEvent.click(ask)
  expect(track).toHaveBeenCalledWith('check_next_action_clicked', { properties: { surface: 'web', level: expect.any(String), action: 'ask' } })
  expect(JSON.stringify(track.mock.calls)).not.toContain('40000')
  expect(JSON.stringify(track.mock.calls)).not.toContain('30000')
  fireEvent.change(screen.getByLabelText('내 보증금'), { target: { value: '35000' } })
  expect(screen.queryByRole('link', { name: '등기부 내용을 질문하기' })).toBeNull()
})
