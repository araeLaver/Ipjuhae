'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, LogOut, User, Shield, FileText, Eye, MessageSquare } from 'lucide-react'
import { LogoSymbol } from '@/components/brand/logo-symbol'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MobileNav } from './mobile-nav'
import { ThemeToggle } from './theme-toggle'
import { NotificationCenter } from '@/components/notifications/notification-center'

interface HeaderProps {
  user?: { email: string; userType: 'tenant' | 'landlord' } | null
}

const tenantLinks = [
  { href: '/profile', label: '프로필' },
  { href: '/profile/verification', label: '인증' },
  { href: '/profile/reference', label: '레퍼런스' },
  { href: '/profile/consent', label: '동의' },
  { href: '/profile/consent/events', label: '동의 이력' },
  { href: '/profile/access-logs', label: '열람 기록' },
  { href: '/messages', label: '메시지' },
  { href: '/trust-center', label: '신뢰센터' },
  { href: '/trust/transactions', label: '거래' },
  { href: '/community', label: '커뮤니티' },
]

const landlordLinks = [
  { href: '/landlord', label: '집주인 홈' },
  { href: '/landlord/tenants', label: '세입자 찾기' },
  { href: '/landlord/properties', label: '매물 관리' },
  { href: '/landlord/favorites', label: '즐겨찾기' },
  { href: '/landlord/messages', label: '메시지' },
  { href: '/trust-center', label: '신뢰센터' },
  { href: '/trust/transactions', label: '거래' },
  { href: '/community', label: '커뮤니티' },
  { href: '/landlord/subscription', label: '구독' },
  { href: '/profile/consent', label: '동의' },
  { href: '/profile/consent/events', label: '동의 이력' },
  { href: '/profile/access-logs', label: '열람 기록' },
]

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const navLinks = user?.userType === 'landlord' ? landlordLinks : user ? tenantLinks : []

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/home" className="flex items-center gap-2">
              <LogoSymbol className="h-7 w-7" />
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
            <ThemeToggle />
            {user ? (
              <>
                <NotificationCenter />
                <div className="hidden md:block">
                  <DropdownMenu
                    trigger={
                      <Avatar name={user.email} size="sm" />
                    }
                  >
                    <DropdownMenuItem onClick={() => router.push(user.userType === 'landlord' ? '/landlord' : '/profile')}>
                      <User className="h-4 w-4" />
                      {user.userType === 'landlord' ? '집주인 홈' : '프로필'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/consent')}>
                      <span className="w-full">
                        <Eye className="h-4 w-4" />
                        동의
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/consent/events')}>
                      <span className="w-full">
                        <Eye className="h-4 w-4" />
                        동의 이력
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/access-logs')}>
                      <span className="w-full">
                        <FileText className="h-4 w-4" />
                        열람 기록
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/messages')}>
                      <span className="w-full">
                        <MessageSquare className="h-4 w-4" />
                        메시지
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/reference')}>
                      <Shield className="h-4 w-4" />
                      레퍼런스 요청
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
                  <Button variant="ghost" size="sm">
                    로그인
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">회원가입</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} user={user} navLinks={navLinks} onLogout={handleLogout} />
    </>
  )
}
