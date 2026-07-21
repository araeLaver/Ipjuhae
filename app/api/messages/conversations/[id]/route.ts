import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { z } from 'zod'
import { sanitizeUserInput } from '@/lib/sanitize'
import { notifyNewMessage } from '@/lib/notifications'

// ë©”ì‹œì§€ ?„ì†¡ ?¤í‚¤ë§?
const sendMessageSchema = z.object({
  content: z.string().min(1, 'ë©”ì‹œì§€ë¥??…ë ¥?´ì£¼?¸ìš”').max(1000, 'ë©”ì‹œì§€??1000???´ë‚´ë¡??…ë ¥?´ì£¼?¸ìš”'),
})

interface ConversationRow {
  id: string
  landlord_id: string
  tenant_id: string
  created_at: string
  landlord_name: string
  tenant_name: string
}

interface MessageRow {
  id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender_name: string
  is_mine: boolean
}

interface CountRow {
  total: string
}

// GET /api/messages/conversations/[id] - ?€?”ë°© ë©”ì‹œì§€ ì¡°íšŒ
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
    }

    // ?€?”ë°© ?‘ê·¼ ê¶Œí•œ ?•ì¸
    const conversationResult = await query<ConversationRow>(
      `SELECT c.*,
        lp.name as landlord_name,
        tp.name as tenant_name
       FROM conversations c
       LEFT JOIN profiles lp ON c.landlord_id = lp.user_id
       LEFT JOIN profiles tp ON c.tenant_id = tp.user_id
       WHERE c.id = $1 AND (c.landlord_id = $2 OR c.tenant_id = $2)`,
      [conversationId, payload.userId]
    )

    if (conversationResult.length === 0) {
      return NextResponse.json({ error: '?€?”ë°©??ì°¾ì„ ???†ìŠµ?ˆë‹¤' }, { status: 404 })
    }

    const conversation = conversationResult[0]

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // ë©”ì‹œì§€ ëª©ë¡ ì¡°íšŒ (ìµœì‹ ??
    const messages = await query<MessageRow>(
      `SELECT
        m.id,
        m.sender_id,
        m.content,
        m.is_read,
        m.created_at,
        p.name as sender_name,
        CASE WHEN m.sender_id = $2 THEN true ELSE false END as is_mine
       FROM messages m
       LEFT JOIN profiles p ON m.sender_id = p.user_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [conversationId, payload.userId, limit, offset]
    )

    // ?„ì²´ ë©”ì‹œì§€ ??
    const countResult = await query<CountRow>(
      `SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1`,
      [conversationId]
    )

    const total = parseInt(countResult[0]?.total || '0')

    // ?ë?ë°©ì´ ë³´ë‚¸ ?ˆì½?€ ë©”ì‹œì§€ë¥??½ìŒ ì²˜ë¦¬
    await query(
      `UPDATE messages SET is_read = TRUE
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE`,
      [conversationId, payload.userId]
    )

    // ?ë?ë°??•ë³´
    const isLandlord = conversation.landlord_id === payload.userId
    const otherUser = {
      id: isLandlord ? conversation.tenant_id : conversation.landlord_id,
      name: isLandlord ? conversation.tenant_name : conversation.landlord_name,
      type: isLandlord ? 'tenant' : 'landlord',
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        otherUser,
        createdAt: conversation.created_at,
      },
      messages: messages.reverse(), // ?œê°„?œìœ¼ë¡??•ë ¬
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('ë©”ì‹œì§€ ì¡°íšŒ ?¤ë¥˜:', error)
    return NextResponse.json({ error: 'ë©”ì‹œì§€ë¥?ë¶ˆëŸ¬?¤ëŠ”???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

// POST /api/messages/conversations/[id] - ë©”ì‹œì§€ ?„ì†¡
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
    }

    // ?€?”ë°© ?‘ê·¼ ê¶Œí•œ ?•ì¸ + ?ë?ë°??•ë³´
    const conversationResult = await query<ConversationRow>(
      `SELECT c.*, lp.name as landlord_name, tp.name as tenant_name
       FROM conversations c
       LEFT JOIN profiles lp ON c.landlord_id = lp.user_id
       LEFT JOIN profiles tp ON c.tenant_id = tp.user_id
       WHERE c.id = $1 AND (c.landlord_id = $2 OR c.tenant_id = $2)`,
      [conversationId, payload.userId]
    )

    if (conversationResult.length === 0) {
      return NextResponse.json({ error: '?€?”ë°©??ì°¾ì„ ???†ìŠµ?ˆë‹¤' }, { status: 404 })
    }

    const conversation = conversationResult[0]

    const body = await request.json()
    const validation = sendMessageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const sanitizedContent = sanitizeUserInput(validation.data.content)

    // ë©”ì‹œì§€ ?€??
    const messageResult = await query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, content, is_read, created_at`,
      [conversationId, payload.userId, sanitizedContent]
    )

    // ?€?”ë°© last_message_at ?…ë°?´íŠ¸
    await query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId]
    )

    const message = messageResult[0]

    // ?ë?ë°©ì—ê²??Œë¦¼ ë°œì†¡ (ë¹„ë™ê¸?
    const isLandlord = conversation.landlord_id === payload.userId
    const recipientId = isLandlord ? conversation.tenant_id : conversation.landlord_id
    const senderName = isLandlord ? (conversation.landlord_name || 'ì§‘ì£¼??) : (conversation.tenant_name || '?¸ì…??)
    notifyNewMessage({
      toUserId: recipientId,
      fromName: senderName,
      conversationId,
      preview: sanitizedContent,
    }).catch(() => {})

    const sentMessage = { ...message, is_mine: true, sender_name: senderName }

    // Socket.IOë¡??¤ì‹œê°?ë¸Œë¡œ?œìº?¤íŠ¸
    const io = (globalThis as Record<string, unknown>).io as
      | { to: (room: string) => { emit: (event: string, data: unknown) => void } }
      | undefined
    if (io) {
      // ?ë?ë°©ì—ê²ŒëŠ” is_mine=falseë¡??„ì†¡
      io.to(`conversation:${conversationId}`).emit('message', {
        ...message,
        is_mine: false,
        sender_name: senderName,
      })
    }

    return NextResponse.json({ message: sentMessage })
  } catch (error) {
    console.error('ë©”ì‹œì§€ ?„ì†¡ ?¤ë¥˜:', error)
    return NextResponse.json({ error: 'ë©”ì‹œì§€ ?„ì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

