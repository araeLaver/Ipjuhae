'use client'

import { useEffect, useState } from 'react'
import { Header } from './header'
import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function PageContainer({ children, maxWidth = 'lg', className }: PageContainerProps) {
  const [user, setUser] = useState<{ email: string; userType: 'tenant' | 'landlord' } | null>(null)

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        }
      } catch {}
    }
    fetchUser()
  }, [])

  const maxWidthClass = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header user={user} />
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
