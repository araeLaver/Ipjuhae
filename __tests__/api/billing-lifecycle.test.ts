import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  user: vi.fn(),
  one: vi.fn(),
  query: vi.fn(),
  client: vi.fn(),
  event: vi.fn(),
  retrieve: vi.fn(),
  subscriptions: vi.fn(),
  prices: vi.fn(),
  sessions: vi.fn(),
  pending: vi.fn(),
  portal: vi.fn(),
  customer: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser: m.user }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('@/lib/db', () => ({
  queryOne: m.one,
  query: m.query,
  transaction: async (fn: (client: { query: typeof m.client }) => unknown) =>
    fn({ query: m.client }),
}))
vi.mock('@/lib/stripe', () => ({
  isStripeEnabled: () => true,
  STRIPE_PRICES: { basic: 'price_basic', pro: 'price_pro' },
  stripe: {
    checkout: {
      sessions: { retrieve: m.retrieve, create: m.sessions, list: m.pending },
    },
    prices: { retrieve: m.prices },
    billingPortal: { sessions: { create: m.portal } },
    customers: { create: m.customer },
    subscriptions: { list: m.subscriptions, retrieve: m.subscriptions },
    webhooks: { constructEvent: m.event },
  },
}))
import { GET as confirm } from '@/app/api/landlord/subscription/confirmation/route'
import { POST as checkout } from '@/app/api/landlord/subscription/checkout/route'
import { POST as change } from '@/app/api/landlord/subscription/route'
import { POST as portal } from '@/app/api/landlord/subscription/portal/route'
beforeEach(() => {
  vi.clearAllMocks()
  m.user.mockResolvedValue({
    id: 'landlord-a',
    user_type: 'landlord',
    email: 'qa@example.test',
  })
  m.one.mockResolvedValue(null)
  m.query.mockResolvedValue([])
  m.client.mockImplementation(async (sql: string) => ({
    rows: sql.includes('FROM users') ? [{ stripe_customer_id: 'cus_a' }] : [],
  }))
  m.prices.mockResolvedValue({
    active: true,
    currency: 'krw',
    unit_amount: 19900,
    recurring: { interval: 'month', interval_count: 1 },
  })
  m.subscriptions.mockResolvedValue({ data: [], has_more: false })
  m.pending.mockResolvedValue({ data: [] })
  m.sessions.mockResolvedValue({ url: 'https://checkout.stripe.test/session' })
  m.portal.mockResolvedValue({ url: 'https://billing.stripe.test/session' })
  for (const key of [
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_BASIC',
    'STRIPE_PRICE_PRO',
    'STRIPE_WEBHOOK_SECRET',
  ])
    vi.stubEnv(key, 'configured')
})
afterEach(() => vi.unstubAllEnvs())
const request = (plan = 'basic') =>
  new Request('https://www.ipjuhae.com/api/landlord/subscription/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  })
it('does not turn a success URL into payment evidence', async () => {
  expect(
    (await confirm(new Request('https://site.test/?success=true'))).status,
  ).toBe(400)
  m.retrieve.mockResolvedValue({
    metadata: { userId: 'landlord-a' },
    mode: 'subscription',
    status: 'complete',
    payment_status: 'unpaid',
  })
  expect(
    await (
      await confirm(new Request('https://site.test/?session_id=cs_test_abc'))
    ).json(),
  ).toMatchObject({ paid: false, activated: false })
  expect(m.one).not.toHaveBeenCalled()
})
it('keeps another customer payment private and distinguishes webhook delay', async () => {
  m.retrieve.mockResolvedValue({
    metadata: { userId: 'another' },
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    subscription: 'sub_a',
  })
  expect(
    (await confirm(new Request('https://site.test/?session_id=cs_test_abc')))
      .status,
  ).toBe(404)
  m.retrieve.mockResolvedValue({
    metadata: { userId: 'landlord-a' },
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    subscription: 'sub_a',
  })
  expect(
    await (
      await confirm(new Request('https://site.test/?session_id=cs_test_abc'))
    ).json(),
  ).toMatchObject({ paid: true, activated: false })
  m.one.mockResolvedValue({ plan: 'basic' })
  expect(
    await (
      await confirm(new Request('https://site.test/?session_id=cs_test_abc'))
    ).json(),
  ).toMatchObject({ activated: true, plan: 'basic' })
})
it('blocks paid checkout without signed fulfillment and when prices disagree', async () => {
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
  expect((await checkout(request())).status).toBe(503)
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'configured')
  m.prices.mockResolvedValue({
    active: true,
    currency: 'usd',
    unit_amount: 19900,
    recurring: { interval: 'month', interval_count: 1 },
  })
  expect((await checkout(request())).status).toBe(503)
  expect(m.sessions).not.toHaveBeenCalled()
})
it('does not present a test payment key as production commerce', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_qa')
  expect((await checkout(request())).status).toBe(503)
  expect(m.sessions).not.toHaveBeenCalled()
})
it('routes existing paid customers to management without another subscription', async () => {
  m.subscriptions.mockResolvedValue({
    data: [{ status: 'active' }],
    has_more: false,
  })
  expect(await (await checkout(request())).json()).toMatchObject({
    code: 'BILLING_PORTAL_REQUIRED',
  })
  expect(m.sessions).not.toHaveBeenCalled()
  expect(m.client.mock.calls[0][0]).toContain('pg_advisory_xact_lock')
})
it('reuses an unfinished same-plan checkout and prevents competing plans', async () => {
  m.pending.mockResolvedValue({
    data: [
      {
        mode: 'subscription',
        metadata: { userId: 'landlord-a', plan: 'basic' },
        url: 'https://checkout.stripe.test/existing',
      },
    ],
  })
  expect(await (await checkout(request())).json()).toEqual({
    url: 'https://checkout.stripe.test/existing',
  })
  m.pending.mockResolvedValue({
    data: [
      { mode: 'subscription', metadata: { userId: 'landlord-a', plan: 'pro' } },
    ],
  })
  expect((await checkout(request())).status).toBe(409)
  expect(m.sessions).not.toHaveBeenCalled()
})
it('never stops local entitlement while external billing keeps charging', async () => {
  m.one.mockResolvedValue({ id: 'sub_local' })
  expect((await change(request('free'))).status).toBe(409)
  expect(m.query).not.toHaveBeenCalled()
})
it('uses only the signed-in account customer for billing management', async () => {
  m.user.mockResolvedValue(null)
  expect((await portal()).status).toBe(401)
  m.user.mockResolvedValue({ id: 'landlord-a', user_type: 'landlord' })
  m.one.mockResolvedValue({ stripe_customer_id: 'cus_a' })
  expect((await portal()).status).toBe(200)
  expect(m.portal.mock.calls[0][0]).toMatchObject({
    customer: 'cus_a',
    return_url: 'https://www.ipjuhae.com/landlord/subscription',
  })
})
