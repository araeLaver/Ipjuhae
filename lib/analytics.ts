import { query } from './db'

const isDev = process.env.NODE_ENV === 'development'

export type EventName =
  | 'page_view'
  | 'user_signup'
  | 'profile_complete'
  | 'profile_submitted'
  | 'listing_created'
  | 'listing_submitted'
  | 'match_generated'
  | 'match_viewed'
  | 'listing_viewed'
  | 'match_view_toggle'

export interface TrackOptions {
  userId?: string
  sessionId?: string
  properties?: Record<string, unknown>
  // Allow arbitrary flat properties as a shorthand for `properties`
  [key: string]: unknown
}

/**
 * Server-side track: saves event directly to DB.
 * In dev mode, also logs to console for easy debugging.
 * Never throws — analytics must not block main flow.
 */
export async function trackServer(event: EventName, options: TrackOptions = {}): Promise<void> {
  try {
    const { userId, sessionId, properties, ...extraProps } = options
    const mergedProps = { ...(properties ?? {}), ...extraProps }

    if (isDev) {
      console.log(`[analytics:server] ${event}`, { userId, ...mergedProps })
    }

    await query(
      `INSERT INTO analytics_events (event_name, properties, user_id, session_id)
       VALUES ($1, $2, $3, $4)`,
      [event, JSON.stringify(mergedProps), userId ?? null, sessionId ?? null]
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
    const { sessionId, properties, userId: _uid, ...extraProps } = options
    const mergedProps = { ...(properties ?? {}), ...extraProps }
    const body = JSON.stringify({
      event_name: event,
      properties: mergedProps,
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
