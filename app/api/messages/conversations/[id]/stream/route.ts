import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

interface MessageRow {
  id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender_name: string
  is_mine: boolean
}

interface ConversationCheckRow {
  id: string
}

/**
 * GET /api/messages/conversations/[id]/stream
 * Server-Sent Events — 신규 메시지 스트림
 *
 * 클라이언트는 EventSource로 연결 후:
 *   event: message  → 새 메시지 JSON
 *   event: ping     → 30초마다 keep-alive
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 대화방 접근 권한 확인
  const convResult = await query<ConversationCheckRow>(
    `SELECT id FROM conversations WHERE id = $1 AND (landlord_id = $2 OR tenant_id = $2)`,
    [conversationId, payload.userId]
  )

  if (convResult.length === 0) {
    return new Response('Not Found', { status: 404 })
  }

  // 연결 시점 기준으로 이후 메시지만 스트림
  const since = new URL(request.url).searchParams.get('since') || new Date().toISOString()

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          closed = true
        }
      }

      // 최초 연결 확인
      send('connected', { conversationId, since })

      let lastChecked = since
      let pingCount = 0

      const poll = async () => {
        if (closed) return

        try {
          // 신규 메시지 조회 (lastChecked 이후)
          const newMessages = await query<MessageRow>(
            `SELECT
              m.id,
              m.sender_id,
              m.content,
              m.is_read,
              m.created_at,
              p.name as sender_name,
              CASE WHEN m.sender_id = $3 THEN true ELSE false END as is_mine
             FROM messages m
             LEFT JOIN profiles p ON m.sender_id = p.user_id
             WHERE m.conversation_id = $1 AND m.created_at > $2
             ORDER BY m.created_at ASC`,
            [conversationId, lastChecked, payload.userId]
          )

          if (newMessages.length > 0) {
            // 상대방 메시지 읽음 처리
            await query(
              `UPDATE messages SET is_read = TRUE
               WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE AND created_at > $3`,
              [conversationId, payload.userId, lastChecked]
            )

            for (const msg of newMessages) {
              send('message', msg)
            }
            lastChecked = newMessages[newMessages.length - 1].created_at
          }

          // 30초마다 ping
          pingCount++
          if (pingCount % 15 === 0) {
            send('ping', { ts: Date.now() })
          }
        } catch {
          // DB 오류 시 일시적으로 건너뜀
        }

        if (!closed) {
          setTimeout(poll, 2000) // 2초 polling → 체감상 실시간
        }
      }

      setTimeout(poll, 500) // 초기 0.5초 딜레이

      // 클라이언트 연결 종료 감지
      request.signal.addEventListener('abort', () => {
        closed = true
        try {
          controller.close()
        } catch {
          // 이미 닫힌 경우 무시
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx proxy buffering 비활성화
    },
  })
}
