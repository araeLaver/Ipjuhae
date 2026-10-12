import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  query: vi.fn(),
  invoices: vi.fn(),
  policy: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ query: m.query }))
vi.mock('@/lib/stripe', () => ({ stripe: { invoices: { list: m.invoices } } }))
vi.mock('@/lib/policy-news-store', () => ({ getPolicyNewsStatus: m.policy }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { serviceOperations } from '@/lib/service-operations'
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-11T14:00:00Z'))
  vi.clearAllMocks()
  m.query.mockImplementation(async (sql: string) =>
    sql.includes('DISTINCT payment_ref') ? [{ payment_ref: 'sub_own' }] : [],
  )
  m.policy.mockResolvedValue({ status: 'ok', count: 13 })
  m.invoices.mockResolvedValue({ data: [], has_more: false })
})
afterEach(() => vi.useRealTimers())
it('reports unavailable sources separately from valid empty results', async () => {
  m.query.mockImplementation(async (sql: string) => {
    if (sql.includes('analytics_events')) throw Error('offline')
    return []
  })
  m.invoices.mockRejectedValue(Error('billing offline'))
  const state = await serviceOperations()
  expect(state.activity).toEqual({ available: false, data: null })
  expect(state.revenue).toEqual({ available: false, data: null })
  expect(state.questions).toEqual({ available: true, data: [] })
})
it('counts only own paid invoices by paid date, including invoices created earlier', async () => {
  const paidAt = Math.floor(Date.parse('2026-10-10T00:00:00Z') / 1000)
  const invoice = {
    id: 'in_1',
    currency: 'krw',
    amount_paid: 19900,
    created: 1,
    status_transitions: { paid_at: paidAt },
    parent: { subscription_details: { subscription: 'sub_own' } },
  }
  m.invoices.mockResolvedValue({
    data: [
      invoice,
      {
        ...invoice,
        id: 'other',
        amount_paid: 99999,
        parent: { subscription_details: { subscription: 'sub_other' } },
      },
      { ...invoice, id: 'old', status_transitions: { paid_at: 1 } },
    ],
    has_more: false,
  })
  const state = await serviceOperations()
  expect(state.revenue.data).toEqual({
    totals: { krw: 19900 },
    count: 1,
    partial: false,
    month: '2026-10',
  })
  expect(m.invoices.mock.calls[0][0]).not.toHaveProperty('created')
})
it('marks a bounded billing history as partial instead of a complete monthly total', async () => {
  m.invoices.mockResolvedValue({
    data: [
      { id: 'in_cursor', parent: null, status_transitions: { paid_at: 1 } },
    ],
    has_more: true,
  })
  const state = await serviceOperations()
  expect(state.revenue.data?.partial).toBe(true)
  expect(m.invoices).toHaveBeenCalledTimes(5)
})
