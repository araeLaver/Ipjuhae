import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { z } from 'zod'
import { sanitizeUserInput } from '@/lib/sanitize'
import { notifyNewMessage } from '@/lib/notifications'

// 메시지 전송 스키마
const sendMessageSchema = z.object({
  content: z.string().min(1, '메시지를 입력해주세요').max(1000, '메시지는 1000자 이내로 입력해주세요'),
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

// GET /api/messages/conversations/[id] - 대화방 메시지 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    // 대화방 접근 권한 확인
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
      return NextResponse.json({ error: '대화방을 찾을 수 없습니다' }, { status: 404 })
    }

    const conversation = conversationResult[0]

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // 메시지 목록 조회 (최신순)
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

    // 전체 메시지 수
    const countResult = await query<CountRow>(
      `SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1`,
      [conversationId]
    )

    const total = parseInt(countResult[0]?.total || '0')

    // 상대방이 보낸 안읽은 메시지를 읽음 처리
    await query(
      `UPDATE messages SET is_read = TRUE
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE`,
      [conversationId, payload.userId]
    )

    // 상대방 정보
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
      messages: messages.reverse(), // 시간순으로 정렬
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('메시지 조회 오류:', error)
    return NextResponse.json({ error: '메시지를 불러오는데 실패했습니다' }, { status: 500 })
  }
}

// POST /api/messages/conversations/[id] - 메시지 전송
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    // 대화방 접근 권한 확인 + 상대방 정보
    const conversationResult = await query<ConversationRow>(
      `SELECT c.*, lp.name as landlord_name, tp.name as tenant_name
       FROM conversations c
       LEFT JOIN profiles lp ON c.landlord_id = lp.user_id
       LEFT JOIN profiles tp ON c.tenant_id = tp.user_id
       WHERE c.id = $1 AND (c.landlord_id = $2 OR c.tenant_id = $2)`,
      [conversationId, payload.userId]
    )

    if (conversationResult.length === 0) {
      return NextResponse.json({ error: '대화방을 찾을 수 없습니다' }, { status: 404 })
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

    // 메시지 저장
    const messageResult = await query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, content, is_read, created_at`,
      [conversationId, payload.userId, sanitizedContent]
    )

    // 대화방 last_message_at 업데이트
    await query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId]
    )

    const message = messageResult[0]

    // 상대방에게 알림 발송 (비동기)
    const isLandlord = conversation.landlord_id === payload.userId
    const recipientId = isLandlord ? conversation.tenant_id : conversation.landlord_id
    const senderName = isLandlord ? (conversation.landlord_name || '집주인') : (conversation.tenant_name || '세입자')
    notifyNewMessage({
      toUserId: recipientId,
      fromName: senderName,
      conversationId,
      preview: sanitizedContent,
    }).catch(() => {})

    const sentMessage = { ...message, is_mine: true, sender_name: senderName }

    // Socket.IO로 실시간 브로드캐스트
    const io = (globalThis as Record<string, unknown>).io as
      | { to: (room: string) => { emit: (event: string, data: unknown) => void } }
      | undefined
    if (io) {
      // 상대방에게는 is_mine=false로 전송
      io.to(`conversation:${conversationId}`).emit('message', {
        ...message,
        is_mine: false,
        sender_name: senderName,
      })
    }

    return NextResponse.json({ message: sentMessage })
  } catch (error) {
    console.error('메시지 전송 오류:', error)
    return NextResponse.json({ error: '메시지 전송에 실패했습니다' }, { status: 500 })
  }
}
