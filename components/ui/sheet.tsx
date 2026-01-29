'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  side?: 'left' | 'right'
}

export function Sheet({ open, onClose, children, side = 'left' }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          'fixed top-0 bottom-0 w-[280px] bg-background shadow-elevated transition-transform duration-300 ease-out',
          side === 'left' ? 'left-0' : 'right-0'
        )}
      >
        <div className="flex items-center justify-end p-4">
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}
