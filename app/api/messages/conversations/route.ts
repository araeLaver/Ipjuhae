import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { z } from 'zod'

// ?€?”ë°© ?ì„± ?¤í‚¤ë§?
const createConversationSchema = z.object({
  targetUserId: z.string().uuid('? íš¨?˜ì? ?Šì? ?¬ìš©??ID?…ë‹ˆ??),
  initialMessage: z.string().min(1, 'ë©”ì‹œì§€ë¥??…ë ¥?´ì£¼?¸ìš”').max(1000, 'ë©”ì‹œì§€??1000???´ë‚´ë¡??…ë ¥?´ì£¼?¸ìš”').optional(),
})

interface ConversationRow {
  id: string
  landlord_id: string
  tenant_id: string
  last_message_at: string
  created_at: string
  other_user_name: string
  other_user_id: string
  other_user_type: 'landlord' | 'tenant'
  last_message: string | null
  unread_count: number
}

interface CountRow {
  total: string
}

interface UserRow {
  user_type: 'landlord' | 'tenant'
}

interface IdRow {
  id: string
}

// GET /api/messages/conversations - ?€?”ë°© ëª©ë¡ ì¡°íšŒ
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // ?¬ìš©?ì˜ ?€?”ë°© ëª©ë¡ ì¡°íšŒ (ì§‘ì£¼???ëŠ” ?¸ì…??
    const conversations = await query<ConversationRow>(
      `SELECT
        c.id,
        c.landlord_id,
        c.tenant_id,
        c.last_message_at,
        c.created_at,
        -- ?ë?ë°??•ë³´
        CASE
          WHEN c.landlord_id = $1 THEN tp.name
          ELSE lp.name
        END as other_user_name,
        CASE
          WHEN c.landlord_id = $1 THEN c.tenant_id
          ELSE c.landlord_id
        END as other_user_id,
        CASE
          WHEN c.landlord_id = $1 THEN 'tenant'
          ELSE 'landlord'
        END as other_user_type,
        -- ë§ˆì?ë§?ë©”ì‹œì§€
        (
          SELECT content FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC LIMIT 1
        ) as last_message,
        -- ?ˆì½?€ ë©”ì‹œì§€ ??
        (
          SELECT COUNT(*) FROM messages
          WHERE conversation_id = c.id
          AND sender_id != $1
          AND is_read = FALSE
        )::int as unread_count
      FROM conversations c
      LEFT JOIN profiles lp ON c.landlord_id = lp.user_id
      LEFT JOIN profiles tp ON c.tenant_id = tp.user_id
      WHERE c.landlord_id = $1 OR c.tenant_id = $1
      ORDER BY c.last_message_at DESC
      LIMIT $2 OFFSET $3`,
      [payload.userId, limit, offset]
    )

    // ?„ì²´ ?€?”ë°© ??
    const countResult = await query<CountRow>(
      `SELECT COUNT(*) as total FROM conversations
       WHERE landlord_id = $1 OR tenant_id = $1`,
      [payload.userId]
    )

    const total = parseInt(countResult[0]?.total || '0')

    return NextResponse.json({
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('?€?”ë°© ëª©ë¡ ì¡°íšŒ ?¤ë¥˜:', error)
    return NextResponse.json({ error: '?€?”ë°© ëª©ë¡??ë¶ˆëŸ¬?¤ëŠ”???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

// POST /api/messages/conversations - ?€?”ë°© ?ì„± ?ëŠ” ê¸°ì¡´ ?€?”ë°© ë°˜í™˜
export async function POST(request: Request) {
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

    const body = await request.json()
    const validation = createConversationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { targetUserId, initialMessage } = validation.data

    // ?ê¸° ?ì‹ ê³¼ì˜ ?€??ë°©ì?
    if (targetUserId === payload.userId) {
      return NextResponse.json({ error: '?ê¸° ?ì‹ ê³??€?”í•  ???†ìŠµ?ˆë‹¤' }, { status: 400 })
    }

    // ?„ì¬ ?¬ìš©???€???•ì¸
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0) {
      return NextResponse.json({ error: '?¬ìš©?ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤' }, { status: 404 })
    }

    const currentUserType = userResult[0].user_type

    // ?€???¬ìš©??ì¡´ì¬ ë°??€???•ì¸
    const targetResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [targetUserId]
    )

    if (targetResult.length === 0) {
      return NextResponse.json({ error: '?€???¬ìš©?ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤' }, { status: 404 })
    }

    const targetUserType = targetResult[0].user_type

    // ì§‘ì£¼???¸ì…??ê°„ì—ë§??€??ê°€??
    if (currentUserType === targetUserType) {
      return NextResponse.json(
        { error: 'ì§‘ì£¼?¸ê³¼ ?¸ì…??ê°„ì—ë§??€?”í•  ???ˆìŠµ?ˆë‹¤' },
        { status: 400 }
      )
    }

    // landlord_id?€ tenant_id ê²°ì •
    const landlordId = currentUserType === 'landlord' ? payload.userId : targetUserId
    const tenantId = currentUserType === 'tenant' ? payload.userId : targetUserId

    // ê¸°ì¡´ ?€?”ë°© ?•ì¸
    const existingConversation = await query<IdRow>(
      `SELECT id FROM conversations
       WHERE landlord_id = $1 AND tenant_id = $2`,
      [landlordId, tenantId]
    )

    let conversationId: string

    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id
    } else {
      // ???€?”ë°© ?ì„±
      const newConversation = await query<IdRow>(
        `INSERT INTO conversations (landlord_id, tenant_id)
         VALUES ($1, $2)
         RETURNING id`,
        [landlordId, tenantId]
      )
      conversationId = newConversation[0].id
    }

    // ì´ˆê¸° ë©”ì‹œì§€ê°€ ?ˆìœ¼ë©??„ì†¡
    if (initialMessage) {
      await query(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)`,
        [conversationId, payload.userId, initialMessage]
      )

      // ?€?”ë°© last_message_at ?…ë°?´íŠ¸
      await query(
        `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
        [conversationId]
      )
    }

    return NextResponse.json({
      conversationId,
      isNew: existingConversation.length === 0,
    })
  } catch (error) {
    console.error('?€?”ë°© ?ì„± ?¤ë¥˜:', error)
    return NextResponse.json({ error: '?€?”ë°© ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

