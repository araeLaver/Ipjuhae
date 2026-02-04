'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, Menu, LogOut, User, Building, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MobileNav } from './mobile-nav'

interface HeaderProps {
  user?: { email: string; userType: 'tenant' | 'landlord' } | null
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const navLinks = user?.userType === 'landlord'
    ? [
        { href: '/landlord', label: '대시보드' },
        { href: '/landlord/tenants', label: '세입자 찾기' },
        { href: '/landlord/favorites', label: '즐겨찾기' },
        { href: '/landlord/messages', label: '메시지' },
        { href: '/landlord/profile', label: '내 정보' },
      ]
    : user
    ? [
        { href: '/profile', label: '내 프로필' },
        { href: '/profile/verification', label: '인증 관리' },
        { href: '/profile/reference', label: '레퍼런스' },
        { href: '/messages', label: '메시지' },
      ]
    : []

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">입주해</span>
              {user?.userType === 'landlord' && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">집주인</span>
              )}
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden md:block">
                  <DropdownMenu
                    trigger={
                      <Avatar name={user.email} size="sm" />
                    }
                  >
                    <DropdownMenuItem onClick={() => router.push(user.userType === 'landlord' ? '/landlord' : '/profile')}>
                      <User className="h-4 w-4" />
                      {user.userType === 'landlord' ? '대시보드' : '내 프로필'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} destructive>
                      <LogOut className="h-4 w-4" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenu>
                </div>
                <button
                  className="md:hidden p-2 rounded-md hover:bg-muted transition-colors"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">로그인</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">회원가입</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        navLinks={navLinks}
        onLogout={handleLogout}
      />
    </>
  )
}
