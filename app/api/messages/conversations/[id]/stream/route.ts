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
  created_at?: string
}

/**
 * GET /api/messages/conversations/[id]/stream
 * Server-Sent Events for live message polling
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return new Response('Unauthorized', { status: 401 })
  }

  const convResult = await query<ConversationCheckRow>(
    `SELECT id FROM conversations WHERE id = $1 AND (landlord_id = $2 OR tenant_id = $2)`,
    [conversationId, payload.userId]
  )
  if (convResult.length === 0) {
    return new Response('Not Found', { status: 404 })
  }

  const sinceParam = new URL(request.url).searchParams.get('since')
  let since: string
  if (sinceParam) {
    const parsed = new Date(sinceParam)
    if (Number.isNaN(parsed.getTime())) {
      return new Response('Bad Request', { status: 400 })
    }
    since = parsed.toISOString()
  } else {
    const latestMessage = await query<ConversationCheckRow>(
      'SELECT created_at::text AS created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
      [conversationId]
    )
    since = latestMessage[0]?.created_at || new Date(0).toISOString()
  }

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

      send('connected', { conversationId, since })

      let lastChecked = since
      let pingCount = 0

      const poll = async () => {
        if (closed) return

        try {
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

          pingCount++
          if (pingCount % 15 === 0) {
            send('ping', { ts: Date.now() })
          }
        } catch {
          // ignore transient polling errors
        }

        if (!closed) {
          setTimeout(poll, 2000)
        }
      }

      setTimeout(poll, 500)

      request.signal.addEventListener('abort', () => {
        closed = true
        try {
          controller.close()
        } catch {
          // ignore close errors
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
