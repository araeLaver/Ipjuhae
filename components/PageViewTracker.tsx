'use client'

import { usePageView } from '@/hooks/usePageView'

/**
 * Client component that tracks page views on pathname changes.
 * Renders nothing — purely for side effects.
 */
export function PageViewTracker(): null {
  usePageView()
  return null
}
