import { NextResponse } from 'next/server'
import { clearAuthCookie, getRequestToken, revokeToken } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const token = await getRequestToken()
    if (token) {
      await revokeToken(token)
    }
  } catch (error) {
    // 무효화 실패해도 쿠키는 지운다 — 로그아웃 자체를 막지 않는다
    logger.error('로그아웃 토큰 무효화 실패', { error })
  }
  await clearAuthCookie()
  return NextResponse.json({ success: true })
}
