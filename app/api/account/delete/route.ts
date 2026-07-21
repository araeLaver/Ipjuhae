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
      await client.query(
        `UPDATE users
         SET email = $1,
             name = '탈퇴한 사용자',
             phone = NULL,
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
      await client.query('DELETE FROM favorites WHERE user_id = $1', [userId])

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
