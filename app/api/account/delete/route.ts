import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { logger } from '@/lib/logger'
import { clearAuthCookie } from '@/lib/auth'

/**
 * DELETE /api/account/delete
 * GDPR 계정 삭제: 개인정보 익명화 후 계정 비활성화
 *
 * - users: email, name, phone 익명화, deleted_at 설정
 * - profiles: bio, intro, name 익명화
 * - conversations/messages: 유지 (익명 표시)
 * - landlord_references: 유지 (집주인 입장 데이터)
 * - favorites, notifications: 삭제
 */
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const userId = user.id
  const anonymousEmail = `deleted_${userId}@deleted.invalid`

  try {
    // 1. 개인정보 익명화
    await query(
      `UPDATE users
       SET email = $1,
           name = '탈퇴한 사용자',
           phone = NULL,
           deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [anonymousEmail, userId]
    )

    // 2. 프로필 익명화
    await query(
      `UPDATE profiles
       SET name = '탈퇴한 사용자',
           bio = NULL,
           intro = NULL,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    )

    // 3. 알림 삭제
    await query('DELETE FROM notifications WHERE user_id = $1', [userId])

    // 4. 찜 목록 삭제
    await query('DELETE FROM favorites WHERE user_id = $1', [userId])

    // 5. 이미지가 없는 임차인 프로필 초기화
    await query(
      `UPDATE tenant_profiles
       SET workplace = NULL,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    )

    logger.info('계정 삭제(익명화) 완료', { userId })

    await clearAuthCookie()

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('계정 삭제 오류', { userId, error })
    return NextResponse.json({ error: '계정 삭제 중 오류가 발생했습니다' }, { status: 500 })
  }
}
