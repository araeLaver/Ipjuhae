import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { trackServer } from '@/lib/analytics'
import {
  isEventName,
  resolveAnonymousProperties,
  type EventName,
} from '@/lib/analytics-events'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: Request) {
  // Analytics must never crash the caller — always return 200
  try {
    const body = await request.json().catch(() => ({}))
    const { event_name, properties = {}, session_id } = body as {
      event_name?: string
      properties?: Record<string, unknown>
      session_id?: string
    }

    if (!isEventName(event_name)) {
      // Still 200 — analytics errors are silent
      return NextResponse.json({ ok: false, reason: 'invalid_event' }, { status: 200 })
    }

    const eventName: EventName = event_name

    // 익명 전용 이벤트(/check 깔때기)는 누가 보냈는지 알아내려 하지 않는다.
    // 로그인 조회를 건너뛰고, 속성도 허용 목록을 통과한 것만 남긴다.
    // 클라이언트가 실수로 식별자나 금액을 보내도 여기서 버려진다.
    // 익명 판정은 lib/analytics-events.ts 한 곳에서 한다.
    // 깔때기 3종과 `/check` 경로의 page_view가 여기로 떨어진다 —
    // 아래 getCurrentUser 호출 자체에 도달하지 않는다.
    const anonymousProperties = resolveAnonymousProperties(eventName, properties)
    if (anonymousProperties) {
      await trackServer(eventName, { properties: anonymousProperties })

      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // Auth is optional for analytics
    let userId: string | undefined
    try {
      const user = await getCurrentUser()
      if (user?.id) userId = user.id
    } catch {
      // no-op — unauthenticated events are fine
    }

    await trackServer(eventName, {
      userId,
      sessionId: session_id,
      properties,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    logger.error('[api/analytics/event] unexpected error', { error: err })
    // Return 200 regardless — analytics must not block
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
