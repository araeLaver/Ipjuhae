/**
 * Client-side analytics only — no DB imports.
 * Import this in client components/hooks.
 * For server-side tracking, use lib/analytics.ts → trackServer.
 */

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

export interface TrackClientOptions {
  sessionId?: string
  properties?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Client-side track: fire-and-forget POST to /api/analytics/event.
 * Never throws — analytics must not block main flow.
 */
export function track(event: EventName, options: TrackClientOptions = {}): void {
  try {
    const { sessionId, properties = {} } = options
    const body = JSON.stringify({
      event_name: event,
      properties,
      session_id: sessionId,
    })
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
