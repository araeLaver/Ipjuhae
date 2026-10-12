import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { stripe, STRIPE_PRICES, isStripeEnabled } from '@/lib/stripe'
import { transaction } from '@/lib/db'
import { logger } from '@/lib/logger'
import { billingReadiness, billingReturnUrl } from '@/lib/billing'
import { PLAN_LIMITS } from '@/lib/plans'

/**
 * POST /api/landlord/subscription/checkout
 * Stripe Checkout 세션 생성
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user)
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 },
      )
    if (user.user_type !== 'landlord') {
      return NextResponse.json(
        { error: '집주인 전용 기능입니다' },
        { status: 403 },
      )
    }

    if (!isStripeEnabled() || !stripe || !billingReadiness().ready) {
      return NextResponse.json(
        { error: '결제 시스템이 아직 설정되지 않았습니다' },
        { status: 503 },
      )
    }

    const { plan } = await request.json()
    if (!plan || !['basic', 'pro'].includes(plan)) {
      return NextResponse.json(
        { error: '유효하지 않은 플랜입니다' },
        { status: 400 },
      )
    }

    const priceId = STRIPE_PRICES[plan as keyof typeof STRIPE_PRICES]
    if (!priceId) {
      return NextResponse.json(
        { error: '해당 플랜의 가격이 설정되지 않았습니다' },
        { status: 500 },
      )
    }
    const price = await stripe.prices.retrieve(priceId)
    if (
      !price.active ||
      price.currency !== 'krw' ||
      price.unit_amount !== PLAN_LIMITS[plan].price ||
      price.recurring?.interval !== 'month' ||
      price.recurring.interval_count !== 1
    ) {
      return NextResponse.json(
        { error: '요금 설정을 확인 중입니다. 고객 문의로 알려주세요.' },
        { status: 503 },
      )
    }

    return await transaction(async (client) => {
      // Serialize checkout creation per account, including concurrent clicks and retries.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `billing:${user.id}`,
      ])
      // 기존 Stripe customer 조회 또는 생성
      let stripeCustomerId: string | undefined
      const existing = (
        await client.query<{ stripe_customer_id: string }>(
          `SELECT stripe_customer_id FROM users WHERE id = $1`,
          [user.id],
        )
      ).rows[0]

      if (existing?.stripe_customer_id) {
        stripeCustomerId = existing.stripe_customer_id
        const subscriptions = await stripe!.subscriptions.list({
          customer: stripeCustomerId,
          status: 'all',
          limit: 100,
        })
        if (
          subscriptions.has_more ||
          subscriptions.data.some(
            (sub) => !['canceled', 'incomplete_expired'].includes(sub.status),
          )
        ) {
          return NextResponse.json(
            {
              error: '기존 구독의 변경은 결제 관리에서 진행해주세요.',
              code: 'BILLING_PORTAL_REQUIRED',
            },
            { status: 409 },
          )
        }
      } else {
        const customer = await stripe!.customers.create(
          {
            email: user.email,
            metadata: { userId: user.id },
          },
          { idempotencyKey: `ipjuhae-customer-${user.id}` },
        )
        stripeCustomerId = customer.id
        await client.query(
          `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
          [stripeCustomerId, user.id],
        )
      }

      const returnUrl = billingReturnUrl()
      const pending = await stripe!.checkout.sessions.list({
        customer: stripeCustomerId,
        status: 'open',
        limit: 10,
      })
      const matching = pending.data.find(
        (item) =>
          item.mode === 'subscription' &&
          item.metadata?.userId === user.id &&
          item.metadata?.plan === plan,
      )
      if (matching?.url) return NextResponse.json({ url: matching.url })
      if (pending.data.some((item) => item.mode === 'subscription'))
        return NextResponse.json(
          { error: '진행 중인 결제를 완료하거나 취소한 뒤 다시 선택해주세요.' },
          { status: 409 },
        )

      const session = await stripe!.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?canceled=true`,
        metadata: {
          userId: user.id,
          plan,
        },
      })

      logger.info('Stripe Checkout 세션 생성', {
        userId: user.id,
        plan,
        sessionId: session.id,
      })

      return NextResponse.json({ url: session.url })
    })
  } catch (error) {
    logger.error('Checkout 세션 생성 오류', { error })
    return NextResponse.json(
      { error: '결제 세션 생성 중 오류가 발생했습니다' },
      { status: 500 },
    )
  }
}
