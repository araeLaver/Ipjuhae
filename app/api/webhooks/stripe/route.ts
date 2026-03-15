import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { query, queryOne } from '@/lib/db'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

/**
 * POST /api/webhooks/stripe
 * Stripe 웹훅 처리
 */
export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    logger.error('Stripe webhook 서명 검증 실패', { error: err })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutComplete(session)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCanceled(subscription)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Stripe webhook 처리 오류', { error, eventType: event.type })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const plan = session.metadata?.plan as 'basic' | 'pro'

  if (!userId || !plan) {
    logger.error('Checkout 메타데이터 누락', { sessionId: session.id })
    return
  }

  // 기존 구독 비활성화
  await query(
    'UPDATE landlord_subscriptions SET is_active = false WHERE landlord_id = $1',
    [userId]
  )

  // 새 구독 생성
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  await query(
    `INSERT INTO landlord_subscriptions (landlord_id, plan, expires_at, is_active, payment_ref)
     VALUES ($1, $2, $3, true, $4)`,
    [userId, plan, expiresAt.toISOString(), session.subscription as string]
  )

  logger.info('구독 활성화', { userId, plan, subscriptionId: session.subscription })
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const sub = await queryOne<{ id: string }>(
    'SELECT id FROM landlord_subscriptions WHERE payment_ref = $1',
    [subscription.id]
  )

  if (!sub) return

  const isActive = subscription.status === 'active'
  const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000)

  await query(
    'UPDATE landlord_subscriptions SET is_active = $1, expires_at = $2 WHERE payment_ref = $3',
    [isActive, periodEnd.toISOString(), subscription.id]
  )

  logger.info('구독 업데이트', { subscriptionId: subscription.id, status: subscription.status })
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  await query(
    'UPDATE landlord_subscriptions SET is_active = false WHERE payment_ref = $1',
    [subscription.id]
  )

  logger.info('구독 취소', { subscriptionId: subscription.id })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as unknown as { subscription: string | null }).subscription
  if (!subscriptionId) return

  logger.warn('결제 실패', {
    subscriptionId,
    customerId: invoice.customer,
    amountDue: invoice.amount_due,
  })
}
