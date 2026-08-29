/**
 * Cron: 오래된 알림 및 만료된 OTP 정리
 *
 * GET /api/cron/cleanup
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * 매일 새벽 3시 실행 (외부 스케줄러 설정 필요).
 * - 30일 이상 지난 읽은 알림 삭제
 * - 만료된 phone_verifications OTP 삭제
 */
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [notifResult, otpResult, revokedResult] = await Promise.all([
      // 30일 이상 된 읽은 알림 삭제
      query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM notifications
           WHERE is_read = true
             AND created_at < NOW() - INTERVAL '30 days'
           RETURNING id
         )
         SELECT COUNT(*)::text AS count FROM deleted`,
        []
      ),
      // 만료된 OTP 코드 삭제
      query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM phone_verifications
           WHERE expires_at < NOW()
           RETURNING id
         )
         SELECT COUNT(*)::text AS count FROM deleted`,
        []
      ),
      // 원 토큰이 만료된 무효화 항목 삭제 (더 이상 거부 목록이 필요 없음)
      query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM revoked_tokens
           WHERE expires_at < NOW()
           RETURNING jti
         )
         SELECT COUNT(*)::text AS count FROM deleted`,
        []
      ),
    ])

    const deletedNotifs = parseInt(notifResult[0]?.count ?? '0')
    const deletedOtps = parseInt(otpResult[0]?.count ?? '0')
    const deletedRevoked = parseInt(revokedResult[0]?.count ?? '0')

    logger.info('Cron cleanup 완료', { deletedNotifs, deletedOtps, deletedRevoked })

    return NextResponse.json({ ok: true, deletedNotifs, deletedOtps, deletedRevoked })
  } catch (error) {
    logger.error('Cron cleanup 오류', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
