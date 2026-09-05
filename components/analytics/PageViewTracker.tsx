'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics-client'
import { getAttribution } from '@/lib/attribution'

export function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    // properties 안에 넣어야 저장된다. 예전에는 path를 최상위로 넘겨서
    // analytics_events.properties가 전부 빈 객체로 쌓였다.
    track('page_view', { properties: { path: pathname, ...getAttribution() } })
  }, [pathname])

  return null
}
