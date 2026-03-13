'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics'

export function usePageView(): void {
  const pathname = usePathname()

  useEffect(() => {
    track('page_view', {
      properties: { path: pathname },
    })
  }, [pathname])
}
