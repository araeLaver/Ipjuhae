import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { isStripeEnabled } from '@/lib/stripe'

interface Subscription {
  id: string
  plan: 'free' | 'basic' | 'pro'
  started_at: string
  expires_at: string | null
  is_active: boolean
}

interface PlanLimits {
  maxProperties: number
  maxFeatured: number
  label: string
  price: number
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free:  { maxProperties: 3,   maxFeatured: 0, label: '무료',      price: 0 },
  basic: { maxProperties: 10,  maxFeatured: 2, label: '베이직',    price: 19900 },
  pro:   { maxProperties: 999, maxFeatured: 5, label: '프로',      price: 49900 },
}

/**
 * GET /api/landlord/subscription
 * 현재 구독 정보 조회
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    if (user.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인 전용 기능입니다' }, { status: 403 })
    }

    // 활성 구독 조회
    const sub = await queryOne<Subscription>(
      `SELECT id, plan, started_at, expires_at, is_active
       FROM landlord_subscriptions
       WHERE landlord_id = $1
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    )

    const currentPlan = sub?.plan || 'free'
    const limits = PLAN_LIMITS[currentPlan]

    // 현재 매물 수 / featured 수
    const counts = await queryOne<{ property_count: string; featured_count: string }>(
      `SELECT
        COUNT(*) AS property_count,
        COUNT(*) FILTER (WHERE is_featured = true) AS featured_count
       FROM properties
       WHERE landlord_id = $1 AND status != 'hidden'`,
      [user.id]
    )

    return NextResponse.json({
      subscription: sub || null,
      plan: currentPlan,
      limits,
      usage: {
        properties: parseInt(counts?.property_count || '0', 10),
        featured:   parseInt(counts?.featured_count  || '0', 10),
      },
      plans: PLAN_LIMITS,
      stripeEnabled: isStripeEnabled(),
    })
  } catch (error) {
    logger.error('구독 조회 오류', { error })
    return NextResponse.json({ error: '구독 정보 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

/**
 * POST /api/landlord/subscription
 * 플랜 변경: Stripe 설정 시 → Checkout 리다이렉트, 미설정 시 → 데모 즉시 적용
 * 무료 플랜은 항상 즉시 적용
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    if (user.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인 전용 기능입니다' }, { status: 403 })
    }

    const { plan } = await request.json()
    if (!plan || !PLAN_LIMITS[plan]) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다' }, { status: 400 })
    }

    // 무료 플랜으로 다운그레이드는 항상 즉시 적용
    if (plan === 'free') {
      await query(
        'UPDATE landlord_subscriptions SET is_active = false WHERE landlord_id = $1',
        [user.id]
      )
      logger.info('무료 플랜으로 다운그레이드', { landlordId: user.id })
      return NextResponse.json({ plan: 'free', limits: PLAN_LIMITS.free }, { status: 200 })
    }

    // Stripe가 설정되어 있으면 Checkout으로 리다이렉트 안내
    if (isStripeEnabled()) {
      return NextResponse.json(
        { error: 'Stripe Checkout을 사용하세요', redirect: '/api/landlord/subscription/checkout' },
        { status: 400 }
      )
    }

    // Stripe 미설정: 데모 모드 (즉시 적용)
    await query(
      'UPDATE landlord_subscriptions SET is_active = false WHERE landlord_id = $1',
      [user.id]
    )

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const [sub] = await query<Subscription>(
      `INSERT INTO landlord_subscriptions (landlord_id, plan, expires_at, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [user.id, plan, expiresAt.toISOString()]
    )

    logger.info('구독 플랜 변경 (데모)', { landlordId: user.id, plan })

    return NextResponse.json({ subscription: sub, plan, limits: PLAN_LIMITS[plan] }, { status: 201 })
  } catch (error) {
    logger.error('구독 변경 오류', { error })
    return NextResponse.json({ error: '구독 변경 중 오류가 발생했습니다' }, { status: 500 })
  }
}
