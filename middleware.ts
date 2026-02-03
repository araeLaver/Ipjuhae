import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Edge Runtime에서는 jsonwebtoken을 사용할 수 없으므로
 * Web Crypto API를 사용하여 JWT HS256 서명을 검증합니다.
 */
async function verifyJwtSignature(token: string): Promise<boolean> {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      if (process.env.NODE_ENV === 'production') return false
      // 개발 환경 폴백
      return verifyWithSecret(token, 'dev-only-secret-do-not-use-in-production')
    }
    return verifyWithSecret(token, secret)
  } catch {
    return false
  }
}

async function verifyWithSecret(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [header, payload, signature] = parts

  // 헤더 검증: HS256만 허용
  try {
    const headerJson = JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/')))
    if (headerJson.alg !== 'HS256') return false
  } catch {
    return false
  }

  // 만료 시간 확인
  try {
    const payloadJson = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (!payloadJson.exp || payloadJson.exp * 1000 < Date.now()) return false
  } catch {
    return false
  }

  // 서명 검증
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const data = encoder.encode(`${header}.${payload}`)
  const sig = Uint8Array.from(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )

  return crypto.subtle.verify('HMAC', key, sig, data)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value
  const hasValidToken = token ? await verifyJwtSignature(token) : false

  // Public routes
  if (
    pathname.startsWith('/reference/survey') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next()
  }

  // Protected routes
  const protectedPrefixes = ['/profile', '/onboarding', '/landlord', '/verify-phone']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  if (isProtected && !hasValidToken) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Auth pages — redirect if already logged in
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
