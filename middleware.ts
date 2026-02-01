import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload.exp) return false

    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value
  const hasValidToken = token ? isTokenValid(token) : false

  // Public routes — always pass through
  if (
    pathname.startsWith('/reference/survey') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next()
  }

  // Protected routes — redirect to login if no valid token
  const protectedPrefixes = ['/profile', '/onboarding', '/landlord', '/verify-phone']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  if (isProtected && !hasValidToken) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Auth pages — redirect to profile if already logged in
  const authPages = ['/login', '/signup']
  const isAuthPage = authPages.some((p) => pathname === p)

  if (isAuthPage && hasValidToken) {
    const profileUrl = request.nextUrl.clone()
    profileUrl.pathname = '/profile'
    return NextResponse.redirect(profileUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
