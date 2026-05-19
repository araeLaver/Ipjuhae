'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/toast'
import { PageViewTracker } from '@/components/analytics/PageViewTracker'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PageViewTracker />
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
