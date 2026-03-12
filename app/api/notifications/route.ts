import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface CountRow {
  total: string
  unread: string
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')       // created_at ISO string
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const unreadOnly = searchParams.get('unread') === 'true'

  try {
    const baseWhere = `user_id = $1${unreadOnly ? ' AND is_read = FALSE' : ''}${cursor ? ` AND created_at < $${unreadOnly ? 3 : 2}` : ''}`
    const params: (string | number)[] = [payload.userId]
    if (cursor) params.push(cursor)
    params.push(limit)

    const notifications = await query<NotificationRow>(
      `SELECT id, type, title, body, link, is_read, read_at, metadata, created_at
       FROM notifications
       WHERE ${baseWhere}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    )

    const counts = await query<CountRow>(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread
       FROM notifications
       WHERE user_id = $1`,
      [payload.userId]
    )

    const nextCursor =
      notifications.length === limit
        ? notifications[notifications.length - 1].created_at
        : null

    return NextResponse.json({
      notifications,
      unreadCount: parseInt(counts[0]?.unread || '0'),
      totalCount: parseInt(counts[0]?.total || '0'),
      nextCursor,
    })
  } catch (error) {
    console.error('알림 목록 조회 오류:', error)
    return NextResponse.json({ error: '알림을 불러오는데 실패했습니다' }, { status: 500 })
  }
}
