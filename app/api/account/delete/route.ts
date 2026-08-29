import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { transaction } from '@/lib/db'
import { logger } from '@/lib/logger'
import { clearAuthCookie } from '@/lib/auth'

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  const userId = user.id
  const anonymousEmail = `deleted_${userId}@deleted.invalid`

  try {
    await transaction(async (client) => {
      // 매물 행은 계약 점검 리포트의 참조 무결성을 위해 보존하되,
      // 공개를 즉시 중단하고 위치 개인정보는 복원할 수 없는 값으로 치환한다.
      await client.query(
        `UPDATE properties
         SET status = 'hidden',
             address = '탈퇴 회원 비공개 매물',
             address_detail = NULL,
             region = NULL,
             updated_at = NOW()
         WHERE landlord_id = $1`,
        [userId]
      )

      // password_hash를 무효값으로 바꿔 탈퇴 계정으로의 로그인을 차단한다
      // (bcrypt 형식이 아니므로 어떤 비밀번호와도 매칭되지 않음).
      await client.query(
        `UPDATE users
         SET email = $1,
             name = '탈퇴한 사용자',
             phone_number = NULL,
             phone_verified = FALSE,
             profile_image = NULL,
             password_hash = 'deleted',
             deleted_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [anonymousEmail, userId]
      )

      await client.query(
        `UPDATE profiles
         SET name = '탈퇴한 사용자',
             bio = NULL,
             intro = NULL,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      )

      await client.query('DELETE FROM notifications WHERE user_id = $1', [userId])
      await client.query(
        'DELETE FROM tenant_favorites WHERE landlord_id = $1 OR tenant_id = $1',
        [userId]
      )

      // Sensitive verification data (소득·재직·신용) must be erased, not retained.
      await client.query('DELETE FROM verifications WHERE user_id = $1', [userId])

      // Landlord references this tenant collected hold third-party contact PII
      // (landlord name/phone/email); reference_responses cascade via FK.
      await client.query('DELETE FROM landlord_references WHERE user_id = $1', [userId])

      await client.query(
        `UPDATE tenant_profiles
         SET workplace = NULL,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      )
    })

    logger.info('회원 삭제(탈퇴) 처리 완료', { userId })
    await clearAuthCookie()

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('회원 삭제(탈퇴) 처리 중 오류', { userId, error })
    return NextResponse.json(
      { error: '회원 삭제(탈퇴) 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
