import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { z } from 'zod'

// 대화방 생성 스키마
const createConversationSchema = z.object({
  targetUserId: z.string().uuid('유효하지 않은 사용자 ID입니다'),
  initialMessage: z.string().min(1, '메시지를 입력해주세요').max(1000, '메시지는 1000자 이내로 입력해주세요').optional(),
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

// GET /api/messages/conversations - 대화방 목록 조회
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // 사용자의 대화방 목록 조회 (집주인 또는 세입자)
    const conversations = await query<ConversationRow>(
      `SELECT
        c.id,
        c.landlord_id,
        c.tenant_id,
        c.last_message_at,
        c.created_at,
        -- 상대방 정보
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
        -- 마지막 메시지
        (
          SELECT content FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC LIMIT 1
        ) as last_message,
        -- 안읽은 메시지 수
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

    // 전체 대화방 수
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
    console.error('대화방 목록 조회 오류:', error)
    return NextResponse.json({ error: '대화방 목록을 불러오는데 실패했습니다' }, { status: 500 })
  }
}

// POST /api/messages/conversations - 대화방 생성 또는 기존 대화방 반환
export async function POST(request: Request) {
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

    const body = await request.json()
    const validation = createConversationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { targetUserId, initialMessage } = validation.data

    // 자기 자신과의 대화 방지
    if (targetUserId === payload.userId) {
      return NextResponse.json({ error: '자기 자신과 대화할 수 없습니다' }, { status: 400 })
    }

    // 현재 사용자 타입 확인
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
    }

    const currentUserType = userResult[0].user_type

    // 대상 사용자 존재 및 타입 확인
    const targetResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [targetUserId]
    )

    if (targetResult.length === 0) {
      return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다' }, { status: 404 })
    }

    const targetUserType = targetResult[0].user_type

    // 집주인-세입자 간에만 대화 가능
    if (currentUserType === targetUserType) {
      return NextResponse.json(
        { error: '집주인과 세입자 간에만 대화할 수 있습니다' },
        { status: 400 }
      )
    }

    // landlord_id와 tenant_id 결정
    const landlordId = currentUserType === 'landlord' ? payload.userId : targetUserId
    const tenantId = currentUserType === 'tenant' ? payload.userId : targetUserId

    // 기존 대화방 확인
    const existingConversation = await query<IdRow>(
      `SELECT id FROM conversations
       WHERE landlord_id = $1 AND tenant_id = $2`,
      [landlordId, tenantId]
    )

    let conversationId: string

    if (existingConversation.length > 0) {
      conversationId = existingConversation[0].id
    } else {
      // 새 대화방 생성
      const newConversation = await query<IdRow>(
        `INSERT INTO conversations (landlord_id, tenant_id)
         VALUES ($1, $2)
         RETURNING id`,
        [landlordId, tenantId]
      )
      conversationId = newConversation[0].id
    }

    // 초기 메시지가 있으면 전송
    if (initialMessage) {
      await query(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)`,
        [conversationId, payload.userId, initialMessage]
      )

      // 대화방 last_message_at 업데이트
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
    console.error('대화방 생성 오류:', error)
    return NextResponse.json({ error: '대화방 생성에 실패했습니다' }, { status: 500 })
  }
}
