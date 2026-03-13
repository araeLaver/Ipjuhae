const isDev = process.env.NODE_ENV !== 'production'

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (isDev) {
    console.log(`[analytics] ${name}`, properties ?? '')
  }
  // PostHog swap-ready: replace with posthog.capture(name, properties)
}

/** @deprecated Use trackEvent instead */
export const track = trackEvent
