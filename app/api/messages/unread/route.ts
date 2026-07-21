import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

interface CountRow {
  unread_count: string
}

// GET /api/messages/unread - ?ˆì½?€ ë©”ì‹œì§€ ??ì¡°íšŒ
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
    }

    // ?¬ìš©?ê? ì°¸ì—¬???€?”ë°©???ˆì½?€ ë©”ì‹œì§€ ??ì¡°íšŒ
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
    console.error('?ˆì½?€ ë©”ì‹œì§€ ??ì¡°íšŒ ?¤ë¥˜:', error)
    return NextResponse.json({ error: '?ˆì½?€ ë©”ì‹œì§€ ?˜ë? ë¶ˆëŸ¬?¤ëŠ”???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

