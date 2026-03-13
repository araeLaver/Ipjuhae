import { query } from './db'

export type EventName =
  | 'page_view'
  | 'user_signup'
  | 'profile_complete'
  | 'listing_created'
  | 'match_viewed'
  | 'listing_viewed'

export interface TrackOptions {
  userId?: string
  sessionId?: string
  properties?: Record<string, unknown>
}

/**
 * Server-side track: saves event directly to DB.
 * Never throws — analytics must not block main flow.
 */
export async function trackServer(event: EventName, options: TrackOptions = {}): Promise<void> {
  try {
    const { userId, sessionId, properties = {} } = options
    await query(
      `INSERT INTO analytics_events (event_name, properties, user_id, session_id)
       VALUES ($1, $2, $3, $4)`,
      [event, JSON.stringify(properties), userId ?? null, sessionId ?? null]
    )
  } catch (err) {
    console.error('[analytics:trackServer] failed to track event', event, err)
  }
}

/**
 * Client-side track: fire-and-forget POST to /api/analytics/event.
 * Never throws — analytics must not block main flow.
 */
export function track(event: EventName, options: TrackOptions = {}): void {
  try {
    const { sessionId, properties = {} } = options
    const body = JSON.stringify({
      event_name: event,
      properties,
      session_id: sessionId,
    })
    // Use sendBeacon when available for reliability on page unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/analytics/event', blob)
    } else {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // intentionally swallowed
      })
    }
  } catch (err) {
    console.error('[analytics:track] failed to track event', event, err)
  }
}

/** @deprecated Use track instead */
export const trackEvent = track
