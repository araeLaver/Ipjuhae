import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  if (user.user_type !== 'landlord')
    return NextResponse.json(
      { error: '집주인 전용 기능입니다' },
      { status: 403 },
    )
  const id = new URL(request.url).searchParams.get('session_id')
  if (!id || !/^cs_[A-Za-z0-9_]{1,240}$/.test(id))
    return NextResponse.json(
      { error: '결제 확인 정보가 없습니다' },
      { status: 400 },
    )
  if (!stripe)
    return NextResponse.json(
      { error: '결제 확인에 연결하지 못했습니다' },
      { status: 503 },
    )
  try {
    const session = await stripe.checkout.sessions.retrieve(id)
    // A session identifier or success query string is never proof of payment or ownership.
    if (session.metadata?.userId !== user.id)
      return NextResponse.json(
        { error: '결제 확인 정보를 찾을 수 없습니다' },
        { status: 404 },
      )
    const paid =
      session.mode === 'subscription' &&
      session.status === 'complete' &&
      session.payment_status === 'paid'
    const ref =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id
    const sub =
      paid && ref
        ? await queryOne<{ plan: string }>(
            `SELECT plan FROM landlord_subscriptions WHERE landlord_id = $1 AND payment_ref = $2 AND is_active = true AND expires_at > NOW()`,
            [user.id, ref],
          )
        : null
    return NextResponse.json(
      { paid, activated: !!sub, plan: sub?.plan || null },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    logger.error('Checkout confirmation failed', { error })
    return NextResponse.json(
      {
        error:
          '결제 상태를 확인하지 못했습니다. 결제 내역을 확인하고 다시 시도해주세요.',
      },
      { status: 502 },
    )
  }
}
