import { NextResponse } from 'next/server'
import { clearAuthCookie, getRequestToken, revokeToken, verifyTokenAllowed } from '@/lib/auth'
import { query } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const token = await getRequestToken()
    if (token) {
      try {
        const payload = await verifyTokenAllowed(token)
        if (payload?.userId) {
          // 개별 기기 DELETE가 실패했을 때를 대비한 서버 측 방어선이다.
          await query('DELETE FROM push_tokens WHERE user_id = $1', [payload.userId])
        }
      } catch (error) {
        logger.error('로그아웃 push token 정리 실패', { error })
      }
      await revokeToken(token)
    }
  } catch (error) {
    // 무효화 실패해도 쿠키는 지운다 — 로그아웃 자체를 막지 않는다
    logger.error('로그아웃 토큰 무효화 실패', { error })
  }
  await clearAuthCookie()
  return NextResponse.json({ success: true })
}
