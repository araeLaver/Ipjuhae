import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(_request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })

  try {
    const result = await query<{ count: string }>(
      `WITH updated AS (
        UPDATE notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE user_id = $1 AND is_read = FALSE
        RETURNING id
       )
       SELECT COUNT(*)::text AS count FROM updated`,
      [payload.userId]
    )

    return NextResponse.json({
      success: true,
      markedCount: parseInt(result[0]?.count || '0'),
    })
  } catch (error) {
    console.error('전체 읽음 처리 오류:', error)
    return NextResponse.json({ error: '처리에 실패했습니다' }, { status: 500 })
  }
}
