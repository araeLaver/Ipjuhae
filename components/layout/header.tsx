'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, LogOut } from 'lucide-react'
import { LogoSymbol } from '@/components/brand/logo-symbol'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MobileNav } from './mobile-nav'
import { ThemeToggle } from './theme-toggle'
import { NotificationCenter } from '@/components/notifications/notification-center'

import type { HeaderUser } from './header-user'

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

const brokerLinks = [
  { href: '/profile', label: '중개사 프로필' },
  { href: '/messages', label: '메시지' },
  { href: '/trust-center', label: '신뢰센터' },
  { href: '/trust/transactions', label: '거래' },
  { href: '/community', label: '커뮤니티' },
]

const adminLinks = [
  { href: '/admin', label: '관리자 홈' },
  { href: '/admin/users', label: '회원 관리' },
  { href: '/admin/documents', label: '서류 관리' },
  { href: '/admin/disputes', label: '분쟁 관리' },
  { href: '/community', label: '커뮤니티' },
]

const linksByRole = { tenant: tenantLinks, landlord: landlordLinks, broker: brokerLinks, admin: adminLinks }

interface HeaderProps {
  user?: HeaderUser | null
}

export function Header({ user: providedUser }: HeaderProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sessionUser, setUser] = useState<HeaderUser | null>(null)
  const [logoutError, setLogoutError] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const user = providedUser === undefined ? sessionUser : providedUser

  useEffect(() => {
    if (providedUser !== undefined) return
    const controller = new AbortController()
    setMobileOpen(false)
    fetch('/api/auth/me', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = response.ok ? await response.json() : { user: null }
        if (!controller.signal.aborted) setUser(data.user)
      })
      .catch(() => { if (!controller.signal.aborted) setUser(null) })
    return () => controller.abort()
  }, [pathname, providedUser])

  const handleLogout = async () => {
    setLogoutError(false)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Logout failed')
    } catch {
      setLogoutError(true)
      return
    }
    setUser(null)
    setMobileOpen(false)
    router.push('/')
    router.refresh()
  }

  const navLinks = user ? linksByRole[user.userType] ?? [] : []

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
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
                    {navLinks.map((link) => (
                      <DropdownMenuItem key={link.href} onClick={() => router.push(link.href)}>
                        {link.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem onClick={handleLogout} destructive>
                      <LogOut className="h-4 w-4" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenu>
                </div>
                <button
                  aria-label="메뉴 열기"
                  aria-expanded={mobileOpen}
                  className="md:hidden p-2 rounded-md hover:bg-muted transition-colors"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </>
            ) : (
              // 아직 가입을 권할 단계가 아니다. 읽는 사람에게 로그인·회원가입을
              // 들이밀지 않는다. /login 주소는 그대로 살아 있다.
              null
            )}
          </div>
        </div>
      </header>

      {logoutError && <p role="alert" className="p-3 text-sm text-destructive">로그아웃하지 못했습니다. 다시 시도해 주세요.</p>}
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} user={user} navLinks={navLinks} onLogout={handleLogout} />
    </>
  )
}
