import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  event: vi.fn(),
  retrieve: vi.fn(),
  client: vi.fn(),
  query: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  query: m.query,
  transaction: async (fn: (client: { query: typeof m.client }) => unknown) =>
    fn({ query: m.client }),
}))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('@/lib/stripe', () => ({
  STRIPE_PRICES: { basic: 'price_basic', pro: 'price_pro' },
  stripe: {
    webhooks: { constructEvent: m.event },
    subscriptions: { retrieve: m.retrieve },
  },
}))
let webhook: typeof import('@/app/api/webhooks/stripe/route').POST
const session = {
  id: 'cs_test',
  metadata: { userId: 'landlord-a', plan: 'basic' },
  subscription: 'sub_a',
  mode: 'subscription',
  payment_status: 'paid',
}
const sub = {
  id: 'sub_a',
  status: 'active',
  items: {
    data: [{ price: { id: 'price_basic' }, current_period_end: 1900000000 }],
  },
}
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'qa-webhook')
  m.event.mockReturnValue({
    type: 'checkout.session.completed',
    data: { object: session },
  })
  m.retrieve.mockResolvedValue(sub)
  m.client.mockResolvedValue({ rows: [] })
  m.query.mockResolvedValue([{ id: 'local' }])
  webhook = (await import('@/app/api/webhooks/stripe/route')).POST
})
afterEach(() => vi.unstubAllEnvs())
const request = () =>
  new Request('https://site.test/api/webhooks/stripe', {
    method: 'POST',
    body: '{}',
    headers: { 'stripe-signature': 'qa-signed' },
  })
it('rejects forged signatures and never grants unpaid checkouts', async () => {
  m.event.mockImplementationOnce(() => {
    throw Error('signature')
  })
  expect((await webhook(request())).status).toBe(400)
  m.event.mockReturnValue({
    type: 'checkout.session.completed',
    data: { object: { ...session, payment_status: 'unpaid' } },
  })
  expect((await webhook(request())).status).toBe(200)
  expect(m.retrieve).not.toHaveBeenCalled()
  expect(m.client).not.toHaveBeenCalled()
})
it('does not grant production entitlement for a test-mode event', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  m.event.mockReturnValue({
    type: 'checkout.session.completed',
    livemode: false,
    data: { object: session },
  })
  expect((await webhook(request())).status).toBe(400)
  expect(m.client).not.toHaveBeenCalled()
})
it('retries provider failure without fabricating a 30-day paid entitlement', async () => {
  m.retrieve.mockRejectedValue(Error('provider offline'))
  expect((await webhook(request())).status).toBe(500)
  expect(m.client).not.toHaveBeenCalled()
})
it('verifies the paid price and preserves the real period when creating entitlement', async () => {
  expect((await webhook(request())).status).toBe(200)
  expect(m.client.mock.calls[0][0]).toContain('pg_advisory_xact_lock')
  const insert = m.client.mock.calls.find((call) =>
    call[0].includes('INSERT INTO landlord_subscriptions'),
  )
  expect(insert?.[1]).toEqual([
    'landlord-a',
    'basic',
    new Date(1900000000 * 1000).toISOString(),
    'sub_a',
  ])
  m.client.mockClear()
  m.retrieve.mockResolvedValue({
    ...sub,
    items: {
      data: [
        { price: { id: 'other_product' }, current_period_end: 1900000000 },
      ],
    },
  })
  expect((await webhook(request())).status).toBe(500)
  expect(m.client).not.toHaveBeenCalled()
})
it('updates the local plan after a provider-side change and deactivates canceled subscription', async () => {
  m.event.mockReturnValue({
    type: 'customer.subscription.updated',
    data: {
      object: {
        ...sub,
        items: {
          data: [
            { price: { id: 'price_pro' }, current_period_end: 1900000000 },
          ],
        },
      },
    },
  })
  expect((await webhook(request())).status).toBe(200)
  expect(
    m.query.mock.calls.find((call) => call[0].startsWith('UPDATE'))?.[1],
  ).toEqual([true, new Date(1900000000 * 1000).toISOString(), 'sub_a', 'pro'])
  m.event.mockReturnValue({
    type: 'customer.subscription.deleted',
    data: { object: sub },
  })
  expect((await webhook(request())).status).toBe(200)
  expect(m.query.mock.calls.at(-1)?.[0]).toContain('is_active = false')
})
it('updates a redelivered checkout without another entitlement and ignores canceled subscriptions', async () => {
  m.client.mockImplementation(async (sql: string) => ({
    rows: sql.includes('SELECT id FROM landlord_subscriptions')
      ? [{ id: 'existing' }]
      : [],
  }))
  expect((await webhook(request())).status).toBe(200)
  expect(
    m.client.mock.calls.some((call) =>
      call[0].includes('INSERT INTO landlord_subscriptions'),
    ),
  ).toBe(false)
  m.client.mockClear()
  m.retrieve.mockResolvedValue({ ...sub, status: 'canceled' })
  expect((await webhook(request())).status).toBe(200)
  expect(m.client).not.toHaveBeenCalled()
})
