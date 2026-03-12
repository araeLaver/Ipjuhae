import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Edge Runtime에서는 jsonwebtoken을 사용할 수 없으므로
 * Web Crypto API를 사용하여 JWT HS256 서명을 검증합니다.
 */
async function verifyAndDecodeJwt(
  token: string
): Promise<{ userId: string; userType?: string } | null> {
  try {
    const secret = process.env.JWT_SECRET
    const effectiveSecret = secret
      ? secret
      : process.env.NODE_ENV === 'production'
        ? null
        : 'dev-only-secret-do-not-use-in-production'

    if (!effectiveSecret) return null
    return decodeWithSecret(token, effectiveSecret)
  } catch {
    return null
  }
}

async function decodeWithSecret(
  token: string,
  secret: string
): Promise<{ userId: string; userType?: string } | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts

  // 헤더 검증: HS256만 허용
  try {
    const headerJson = JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/')))
    if (headerJson.alg !== 'HS256') return null
  } catch {
    return null
  }

  // 만료 시간 확인
  let payloadData: { userId: string; userType?: string; exp?: number }
  try {
    payloadData = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (!payloadData.exp || payloadData.exp * 1000 < Date.now()) return null
  } catch {
    return null
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

  const valid = await crypto.subtle.verify('HMAC', key, sig, data)
  if (!valid) return null

  return { userId: payloadData.userId, userType: payloadData.userType }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value
  const jwtPayload = token ? await verifyAndDecodeJwt(token) : null
  const isAuthenticated = !!jwtPayload
  const userType = jwtPayload?.userType

  // Public routes — always allow
  if (
    pathname.startsWith('/reference/survey') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/properties') // 공개 매물 검색
  ) {
    return NextResponse.next()
  }

  // ── 인증 필요 경로 ──────────────────────────────────────────────
  const protectedPrefixes = ['/profile', '/onboarding', '/landlord', '/admin', '/verify-phone']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  if (isProtected && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 권한 기반 라우팅 ────────────────────────────────────────────
  // /admin/* → admin 전용
  if (pathname.startsWith('/admin') && userType !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // /landlord/* → landlord 또는 admin만
  if (
    pathname.startsWith('/landlord') &&
    userType !== 'landlord' &&
    userType !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/profile', request.url))
  }

  // /onboarding/* → tenant만 (landlord는 /landlord/onboarding)
  if (pathname.startsWith('/onboarding') && userType === 'landlord') {
    return NextResponse.redirect(new URL('/landlord/onboarding', request.url))
  }

  // ── 이미 로그인한 경우 auth 페이지 접근 시 리다이렉트 ────────────
  const authPages = ['/login', '/signup']
  const isAuthPage = authPages.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (isAuthPage && isAuthenticated) {
    // user_type에 맞는 홈으로 리다이렉트
    const destination =
      userType === 'landlord' ? '/landlord' : userType === 'admin' ? '/admin' : '/profile'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
