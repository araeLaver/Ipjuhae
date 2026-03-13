import { NextResponse } from 'next/server'
import { trackServer } from '@/lib/analytics'
import type { EventName } from '@/lib/analytics'
import { getCurrentUser } from '@/lib/auth'

const VALID_EVENTS: EventName[] = [
  'page_view',
  'user_signup',
  'profile_complete',
  'profile_submitted',
  'listing_created',
  'listing_submitted',
  'match_generated',
  'match_viewed',
  'listing_viewed',
]

export async function POST(request: Request) {
  // Analytics must never crash the caller — always return 200
  try {
    const body = await request.json().catch(() => ({}))
    const { event_name, properties = {}, session_id } = body as {
      event_name?: string
      properties?: Record<string, unknown>
      session_id?: string
    }

    if (!event_name || !VALID_EVENTS.includes(event_name as EventName)) {
      // Still 200 — analytics errors are silent
      return NextResponse.json({ ok: false, reason: 'invalid_event' }, { status: 200 })
    }

    // Auth is optional for analytics
    let userId: string | undefined
    try {
      const user = await getCurrentUser()
      if (user?.id) userId = user.id
    } catch {
      // no-op — unauthenticated events are fine
    }

    await trackServer(event_name as EventName, {
      userId,
      sessionId: session_id,
      properties,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[api/analytics/event] unexpected error', err)
    // Return 200 regardless — analytics must not block
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
