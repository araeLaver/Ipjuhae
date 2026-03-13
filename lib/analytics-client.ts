/**
 * Client-side analytics — no DB imports.
 * Import this in client components/hooks.
 * For server-side tracking, use lib/analytics.ts → trackServer.
 *
 * Dev mode: console.log all events for easy debugging.
 * Prod mode: fire-and-forget POST to /api/analytics/event.
 * PostHog-ready: swap the prod implementation when PostHog is integrated.
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

const isDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

/**
 * Client-side track: fire-and-forget POST to /api/analytics/event.
 * In dev mode, also logs to browser console for easy verification.
 * Never throws — analytics must not block main flow.
 */
export function track(event: EventName, options: TrackClientOptions = {}): void {
  try {
    const { sessionId, properties = {} } = options

    // Dev mode: console.log for easy debugging & event verification
    if (isDev) {
      console.log(
        `%c[analytics] ${event}`,
        'color: #6366f1; font-weight: bold',
        properties,
      )
    }

    const body = JSON.stringify({
      event_name: event,
      properties,
      session_id: sessionId,
    })

    // Prod: POST to analytics API (PostHog swap-ready)
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
