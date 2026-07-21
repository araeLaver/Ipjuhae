import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, { params }: Params) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })

  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })

  try {
    const result = await query<{ id: string }>(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND is_read = FALSE
       RETURNING id`,
      [id, payload.userId]
    )

    if (result.length === 0) {
      return NextResponse.json({ success: false, message: '?´ë? ?½ì—ˆê±°ë‚˜ ì¡´ì¬?˜ì? ?ŠëŠ” ?Œë¦¼?…ë‹ˆ?? })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('?Œë¦¼ ?½ìŒ ì²˜ë¦¬ ?¤ë¥˜:', error)
    return NextResponse.json({ error: 'ì²˜ë¦¬???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

