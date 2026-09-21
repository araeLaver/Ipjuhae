'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toast'
import { PageViewTracker } from '@/components/analytics/PageViewTracker'
import { isDemoIsolatedPath } from '@/lib/demo-isolation'

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // /demo/* 는 "운영 API 호출 없음"을 화면에 고지한다. root layout에 매달린 클라이언트
  // 훅을 아예 마운트하지 않아서 그 고지를 구조로 보장한다. 조건 분기를 훅 안쪽마다
  // 두지 않고 여기서 한 번에 끊는다.
  if (isDemoIsolatedPath(pathname)) {
    return <>{children}</>
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PageViewTracker />
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
