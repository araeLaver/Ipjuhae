import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { createSocketToken, SOCKET_TOKEN_TTL_SECONDS } from '@/socket-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  conversationId: z.string().uuid(),
}).strict()

interface ConversationMembershipRow {
  id: string
}

function hasAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return process.env.NODE_ENV !== 'production'

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!configuredAppUrl) return false

  try {
    return new URL(origin).origin === new URL(configuredAppUrl).origin
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
  }

  const { conversationId } = parsed.data
  const membership = await queryOne<ConversationMembershipRow>(
    `SELECT id FROM conversations
     WHERE id = $1 AND (landlord_id = $2 OR tenant_id = $2)`,
    [conversationId, user.id]
  )

  if (!membership) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const token = createSocketToken({ userId: user.id, conversationId })
  return NextResponse.json(
    { token, conversationId, expiresIn: SOCKET_TOKEN_TTL_SECONDS },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
