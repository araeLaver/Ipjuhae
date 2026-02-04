import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

interface CountRow {
  unread_count: string
}

// GET /api/messages/unread - 안읽은 메시지 수 조회
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    // 사용자가 참여한 대화방의 안읽은 메시지 수 조회
    const result = await query<CountRow>(
      `SELECT COUNT(*) as unread_count
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE (c.landlord_id = $1 OR c.tenant_id = $1)
       AND m.sender_id != $1
       AND m.is_read = FALSE`,
      [payload.userId]
    )

    const unreadCount = parseInt(result[0]?.unread_count || '0')

    return NextResponse.json({ unreadCount })
  } catch (error) {
    console.error('안읽은 메시지 수 조회 오류:', error)
    return NextResponse.json({ error: '안읽은 메시지 수를 불러오는데 실패했습니다' }, { status: 500 })
  }
}
