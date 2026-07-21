import { NextResponse } from 'next/server'
import { query, transaction } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

const BILLING_DAYS = 30

type TenantPlan = 'basic' | 'pro'

function isTenantPlan(value: string | undefined): value is TenantPlan {
  return value === 'basic' || value === 'pro'
}

function getDefaultExpiresAt(): string {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + BILLING_DAYS)
  return expiresAt.toISOString()
}

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler
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
    logger.error('Stripe webhook signature invalid', { error: err })
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
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Stripe webhook handler failed', { error, eventType: event.type })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const rawPlan = session.metadata?.plan
  const paymentRef = typeof session.subscription === 'string' ? session.subscription : null

  if (!userId || !isTenantPlan(rawPlan)) {
    logger.error('Checkout completed missing metadata', {
      sessionId: session.id,
      userId: userId ?? null,
      plan: rawPlan,
    })
    return
  }

  await transaction(async (client) => {
    const existingByRef = paymentRef
      ? await client.query<{ id: string }>(
          `SELECT id FROM landlord_subscriptions WHERE payment_ref = $1 FOR UPDATE`,
          [paymentRef]
        )
      : { rows: [] as { id: string }[] }

    const expiresAt =
      typeof session.expires_at === 'number' ? new Date(session.expires_at * 1000).toISOString() : getDefaultExpiresAt()

    if (existingByRef.rows.length > 0) {
      const targetId = existingByRef.rows[0].id
      await client.query(
        `
          UPDATE landlord_subscriptions
          SET landlord_id = $1,
              plan = $2,
              expires_at = $3,
              is_active = true,
              payment_ref = $4,
              updated_at = NOW()
          WHERE id = $5
        `,
        [userId, rawPlan, expiresAt, paymentRef, targetId]
      )

      await client.query(
        `
          UPDATE landlord_subscriptions
          SET is_active = false, updated_at = NOW()
          WHERE landlord_id = $1 AND id <> $2 AND is_active = true
        `,
        [userId, targetId]
      )

      logger.info('Subscription checkout completed (idempotent update)', {
        userId,
        plan: rawPlan,
        subscriptionId: paymentRef,
      })
      return
    }

    await client.query('UPDATE landlord_subscriptions SET is_active = false, updated_at = NOW() WHERE landlord_id = $1', [
      userId,
    ])

    await client.query(
      `
        INSERT INTO landlord_subscriptions (landlord_id, plan, expires_at, is_active, payment_ref)
        VALUES ($1, $2, $3, true, $4)
      `,
      [userId, rawPlan, expiresAt, paymentRef]
    )
  })

  logger.info('Subscription checkout completed (new subscription)', {
    userId,
    plan: rawPlan,
    subscriptionId: paymentRef ?? session.id,
  })
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const periodEnd = typeof subscription.current_period_end === 'number'
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null
  const isActive = subscription.status === 'active'

  const result = await query<{ id: string }>(
    'SELECT id FROM landlord_subscriptions WHERE payment_ref = $1',
    [subscription.id]
  )

  if (result.length === 0) {
    logger.warn('Stripe subscription.update with no matching local record', {
      stripeSubscriptionId: subscription.id,
    })
    return
  }

  const params = [isActive, periodEnd ?? getDefaultExpiresAt(), subscription.id]
  await query(
    'UPDATE landlord_subscriptions SET is_active = $1, expires_at = $2, updated_at = NOW() WHERE payment_ref = $3',
    params
  )

  logger.info('Subscription synchronized', {
    subscriptionId: subscription.id,
    status: subscription.status,
    isActive,
  })
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const result = await query<{ id: string }>(
    'SELECT id FROM landlord_subscriptions WHERE payment_ref = $1',
    [subscription.id]
  )

  if (result.length === 0) {
    logger.warn('Stripe subscription.delete with no matching local record', {
      stripeSubscriptionId: subscription.id,
    })
    return
  }

  await query(
    'UPDATE landlord_subscriptions SET is_active = false, updated_at = NOW() WHERE payment_ref = $1',
    [subscription.id]
  )

  logger.info('Subscription cancelled', { subscriptionId: subscription.id })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as { subscription: string | null }).subscription
  if (!subscriptionId) return

  logger.warn('Payment failed', {
    subscriptionId,
    customerId: invoice.customer,
    amountDue: invoice.amount_due,
  })
}
