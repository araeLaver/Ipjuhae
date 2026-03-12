/**
 * Cron: 레퍼런스 만료 자동 처리
 *
 * 호출 방법:
 *   GET /api/cron/references
 *   Header: Authorization: Bearer <CRON_SECRET>
 *
 * GitHub Actions 또는 외부 스케줄러에서 매일 자정 실행.
 * 만료된 references → status='expired', 알림 발송, 신뢰점수 재계산.
 */
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { logger } from '@/lib/logger'

interface ExpiredReference {
  id: string
  user_id: string
  landlord_name: string
}

export async function GET(request: Request) {
  // Cron secret guard
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. 만료된 references 조회 (token_expires_at 지났고 status='sent')
    const expired = await query<ExpiredReference>(
      `UPDATE landlord_references
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'sent'
         AND token_expires_at < NOW()
       RETURNING id, user_id, landlord_name`,
      []
    )

    logger.info(`Cron: ${expired.length}개 레퍼런스 만료 처리`)

    if (expired.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    // 2. 만료 알림 발송 (사용자별 배치)
    await Promise.allSettled(
      expired.map((ref) =>
        createNotification({
          userId: ref.user_id,
          type: 'reference_request',
          title: '레퍼런스 요청 만료',
          body: `${ref.landlord_name} 집주인에게 보낸 레퍼런스 요청이 7일이 지나 만료되었습니다. 재발송하시겠어요?`,
          link: '/profile?tab=references',
          metadata: { referenceId: ref.id, action: 'expired' },
        })
      )
    )

    // 3. 만료된 유저들의 신뢰점수 재계산
    const userIds = Array.from(new Set(expired.map((r) => r.user_id)))
    await recalculateTrustScores(userIds)

    return NextResponse.json({
      processed: expired.length,
      userIds,
    })
  } catch (error) {
    logger.error('Cron references error:', error as Record<string, unknown>)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * 신뢰점수 재계산 (만료로 인해 completed reference 수 감소 시)
 */
async function recalculateTrustScores(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return

  // 각 유저의 completed reference 수 기반으로 reference_score 재계산
  // trust_score = (verification_score * 0.5) + (reference_score * 0.3) + (profile_score * 0.2)
  for (const userId of userIds) {
    try {
      await query(
        `UPDATE profiles p
         SET reference_score = LEAST(
           (SELECT COUNT(*) FROM landlord_references
            WHERE user_id = $1 AND status = 'completed') * 20,
           100
         ),
         trust_score = LEAST(
           COALESCE(p.verification_score, 0) * 0.5 +
           LEAST((SELECT COUNT(*) FROM landlord_references WHERE user_id = $1 AND status = 'completed') * 20, 100) * 0.3 +
           COALESCE(p.profile_score, 0) * 0.2,
           100
         ),
         updated_at = NOW()
         WHERE p.user_id = $1`,
        [userId]
      )
    } catch (err) {
      logger.error(`Trust score recalc failed for user ${userId}:`, err as Record<string, unknown>)
    }
  }
}
