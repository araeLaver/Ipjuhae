import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { billingReadiness, billingReturnUrl } from '@/lib/billing'
import { logger } from '@/lib/logger'

export async function POST() {
  const user = await getCurrentUser()
  if (!user)
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  if (user.user_type !== 'landlord')
    return NextResponse.json(
      { error: '집주인 전용 기능입니다' },
      { status: 403 },
    )
  if (!stripe || !billingReadiness().ready)
    return NextResponse.json(
      { error: '결제 관리 연결을 사용할 수 없습니다. 고객 문의로 알려주세요.' },
      { status: 503 },
    )
  try {
    const customer = await queryOne<{ stripe_customer_id: string | null }>(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [user.id],
    )
    if (!customer?.stripe_customer_id)
      return NextResponse.json(
        { error: '관리할 결제 계정이 없습니다' },
        { status: 404 },
      )
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: billingReturnUrl(),
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    logger.error('Billing portal unavailable', { error })
    return NextResponse.json(
      {
        error:
          '결제 관리 화면에 연결하지 못했습니다. 잠시 후 다시 시도하거나 고객 문의로 알려주세요.',
      },
      { status: 502 },
    )
  }
}
