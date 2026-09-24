'use client'

import { Header } from './header'
import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function PageContainer({ children, maxWidth = 'lg', className }: PageContainerProps) {
  const maxWidthClass = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
      <Header />
      <main className={cn(
        'flex-1 container mx-auto px-4 py-8 animate-fade-in',
        maxWidthClass[maxWidth],
        className
      )}>
        {children}
      </main>
    </div>
  )
}
