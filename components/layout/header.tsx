'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, Menu, LogOut, User, Shield, FileText, Eye, MessageSquare } from 'lucide-react'
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
  { href: '/profile', label: 'Profile' },
  { href: '/profile/verification', label: 'Verification' },
  { href: '/profile/reference', label: 'References' },
  { href: '/profile/consent', label: 'Consent' },
  { href: '/profile/consent/events', label: 'Consent Events' },
  { href: '/profile/access-logs', label: 'Access Logs' },
  { href: '/messages', label: 'Messages' },
]

const landlordLinks = [
  { href: '/landlord', label: 'Landlord' },
  { href: '/landlord/tenants', label: 'Tenant list' },
  { href: '/landlord/properties', label: 'Properties' },
  { href: '/landlord/favorites', label: 'Favorites' },
  { href: '/landlord/messages', label: 'Messages' },
  { href: '/landlord/subscription', label: 'Subscription' },
  { href: '/profile/consent', label: 'Consent' },
  { href: '/profile/consent/events', label: 'Consent Events' },
  { href: '/profile/access-logs', label: 'Access Logs' },
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
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">RentMe</span>
              {user?.userType === 'landlord' && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Landlord</span>
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
                      {user.userType === 'landlord' ? 'Landlord area' : 'Profile'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/consent')}>
                      <span className="w-full">
                        <Eye className="h-4 w-4" />
                        Consent
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/consent/events')}>
                      <span className="w-full">
                        <Eye className="h-4 w-4" />
                        Consent Events
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/access-logs')}>
                      <span className="w-full">
                        <FileText className="h-4 w-4" />
                        Access Logs
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/messages')}>
                      <span className="w-full">
                        <MessageSquare className="h-4 w-4" />
                        Messages
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/profile/reference')}>
                      <Shield className="h-4 w-4" />
                      Reference requests
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} destructive>
                      <LogOut className="h-4 w-4" />
                      Logout
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
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Signup</Button>
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
