'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isDemoIsolatedPath } from '@/lib/demo-isolation'

export function ServiceWorkerRegistrar() {
  const pathname = usePathname()

  useEffect(() => {
    // demo 캡처 화면에서는 sw.js 등록 요청도 남기지 않는다. production에서 demo route는
    // 404지만, NODE_ENV가 잘못 주입된 환경에서도 고지가 깨지지 않게 경로로 한 번 더 막는다.
    if (isDemoIsolatedPath(pathname)) return
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 등록 실패는 앱 동작에 영향 없음 (설치성만 저하)
    })
  }, [pathname])

  return null
}
