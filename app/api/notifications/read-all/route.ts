import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(_request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })

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
    console.error('?„ì²´ ?½ìŒ ì²˜ë¦¬ ?¤ë¥˜:', error)
    return NextResponse.json({ error: 'ì²˜ë¦¬???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

