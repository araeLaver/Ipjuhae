import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, { params }: Params) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })

  try {
    const result = await query<{ id: string }>(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_read = FALSE
       RETURNING id`,
      [id, payload.userId]
    )

    if (result.length === 0) {
      return NextResponse.json({ success: false, message: '이미 읽었거나 존재하지 않는 알림입니다' })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('알림 읽음 처리 오류:', error)
    return NextResponse.json({ error: '처리에 실패했습니다' }, { status: 500 })
  }
}
