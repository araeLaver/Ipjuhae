import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

const PLAN_MAX_FEATURED: Record<string, number> = {
  free:  0,
  basic: 2,
  pro:   5,
}

/**
 * POST /api/landlord/properties/[id]/feature
 * 매물 피처드 ON/OFF 토글
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    if (user.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인 전용 기능입니다' }, { status: 403 })
    }

    // 매물 소유 확인
    const property = await queryOne<{ id: string; is_featured: boolean }>(
      'SELECT id, is_featured FROM properties WHERE id = $1 AND landlord_id = $2',
      [params.id, user.id]
    )

    if (!property) {
      return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
    }

    // 구독 플랜 확인
    const sub = await queryOne<{ plan: string }>(
      `SELECT plan FROM landlord_subscriptions
       WHERE landlord_id = $1
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    )
    const plan = sub?.plan || 'free'
    const maxFeatured = PLAN_MAX_FEATURED[plan] ?? 0

    if (property.is_featured) {
      // 피처드 해제
      await query(
        'UPDATE properties SET is_featured = false, featured_until = NULL WHERE id = $1',
        [params.id]
      )
      return NextResponse.json({ is_featured: false, message: '피처드가 해제되었습니다' })
    } else {
      // 피처드 등록 — 한도 체크
      if (maxFeatured === 0) {
        return NextResponse.json(
          { error: '현재 플랜에서는 피처드 매물을 사용할 수 없습니다. 베이직 이상으로 업그레이드하세요.' },
          { status: 403 }
        )
      }

      const currentFeatured = await queryOne<{ count: string }>(
        'SELECT COUNT(*) AS count FROM properties WHERE landlord_id = $1 AND is_featured = true',
        [user.id]
      )

      if (parseInt(currentFeatured?.count || '0', 10) >= maxFeatured) {
        return NextResponse.json(
          { error: `현재 플랜의 피처드 한도(${maxFeatured}개)에 도달했습니다.` },
          { status: 403 }
        )
      }

      // 7일 피처드
      const featuredUntil = new Date()
      featuredUntil.setDate(featuredUntil.getDate() + 7)

      await query(
        'UPDATE properties SET is_featured = true, featured_until = $1, boost_score = 100 WHERE id = $2',
        [featuredUntil.toISOString(), params.id]
      )

      logger.info('매물 피처드 등록', { landlordId: user.id, propertyId: params.id, plan })

      return NextResponse.json({
        is_featured: true,
        featured_until: featuredUntil.toISOString(),
        message: '매물이 7일간 상단에 노출됩니다',
      })
    }
  } catch (error) {
    logger.error('피처드 토글 오류', { error })
    return NextResponse.json({ error: '오류가 발생했습니다' }, { status: 500 })
  }
}
