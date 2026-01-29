'use client'

import Link from 'next/link'
import { Sheet } from '@/components/ui/sheet'
import { Home, LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'

interface MobileNavProps {
  open: boolean
  onClose: () => void
  user?: { email: string; userType: 'tenant' | 'landlord' } | null
  navLinks: { href: string; label: string }[]
  onLogout: () => void
}

export function MobileNav({ open, onClose, user, navLinks, onLogout }: MobileNavProps) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <Link href="/" className="flex items-center gap-2" onClick={onClose}>
          <Home className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">입주해</span>
        </Link>

        {user && (
          <div className="flex items-center gap-3 pb-4 border-b">
            <Avatar name={user.email} size="md" />
            <div>
              <p className="text-sm font-medium truncate max-w-[180px]">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                {user.userType === 'landlord' ? '집주인' : '세입자'}
              </p>
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="px-3 py-2.5 text-sm rounded-md hover:bg-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {user && (
          <button
            onClick={() => { onLogout(); onClose() }}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-destructive rounded-md hover:bg-destructive/10 transition-colors mt-auto"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        )}
      </div>
    </Sheet>
  )
}
