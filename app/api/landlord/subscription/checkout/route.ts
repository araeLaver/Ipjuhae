import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { stripe, STRIPE_PRICES, isStripeEnabled } from '@/lib/stripe'
import { queryOne } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * POST /api/landlord/subscription/checkout
 * Stripe Checkout 세션 생성
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    if (user.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인 전용 기능입니다' }, { status: 403 })
    }

    if (!isStripeEnabled() || !stripe) {
      return NextResponse.json({ error: '결제 시스템이 아직 설정되지 않았습니다' }, { status: 503 })
    }

    const { plan } = await request.json()
    if (!plan || !['basic', 'pro'].includes(plan)) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다' }, { status: 400 })
    }

    const priceId = STRIPE_PRICES[plan as keyof typeof STRIPE_PRICES]
    if (!priceId) {
      return NextResponse.json({ error: '해당 플랜의 가격이 설정되지 않았습니다' }, { status: 500 })
    }

    // 기존 Stripe customer 조회 또는 생성
    let stripeCustomerId: string | undefined
    const existing = await queryOne<{ stripe_customer_id: string }>(
      `SELECT stripe_customer_id FROM users WHERE id = $1`,
      [user.id]
    )

    if (existing?.stripe_customer_id) {
      stripeCustomerId = existing.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      })
      stripeCustomerId = customer.id
      await queryOne(
        `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
        [stripeCustomerId, user.id]
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/landlord/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/landlord/subscription?canceled=true`,
      metadata: {
        userId: user.id,
        plan,
      },
    })

    logger.info('Stripe Checkout 세션 생성', { userId: user.id, plan, sessionId: session.id })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    logger.error('Checkout 세션 생성 오류', { error })
    return NextResponse.json({ error: '결제 세션 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
