import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

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

// ── Rate Limiting: Redis (분산) or 인메모리 (폴백) ────────────────────
const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

const apiLimiter = useRedis
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'rl:api',
      analytics: true,
    })
  : null

const authLimiter = useRedis
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:auth',
      analytics: true,
    })
  : null

/** 인메모리 Rate Limit 폴백 (Redis 미설정 시) */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimitLocal(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

async function checkRateLimit(
  key: string,
  isAuth: boolean
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limiter = isAuth ? authLimiter : apiLimiter
  if (limiter) {
    const { success, reset } = await limiter.limit(key)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return { allowed: false, retryAfter: Math.max(1, retryAfter) }
    }
    return { allowed: true }
  }
  // 인메모리 폴백
  const limit = isAuth ? 10 : 60
  const allowed = checkRateLimitLocal(key, limit, 60_000)
  return { allowed, retryAfter: 60 }
}

function getIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}

/** CSRF: mutation 요청에 대해 Origin 헤더를 검증합니다 */
function checkCsrf(request: NextRequest): boolean {
  const method = request.method
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  if (!isMutation) return true

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // 개발 환경에서는 origin 검사 완화
  if (process.env.NODE_ENV !== 'production') return true

  if (origin) {
    return origin === appUrl || origin.startsWith(appUrl)
  }
  if (referer) {
    return referer.startsWith(appUrl)
  }

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getIp(request)

  // ── 잘못된 Server Action 요청 차단 (봇/스캐너 방어) ─────────────
  if (request.headers.get('next-action')) {
    return NextResponse.json(
      { error: 'Server Actions are not supported' },
      { status: 400 }
    )
  }

  // ── Rate Limiting (Redis 분산 or 인메모리 폴백) ─────────────────
  if (pathname.startsWith('/api/auth')) {
    const { allowed, retryAfter } = await checkRateLimit(`auth:${ip}`, true)
    if (!allowed) {
      return NextResponse.json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
      )
    }
  } else if (pathname.startsWith('/api/')) {
    const { allowed, retryAfter } = await checkRateLimit(`api:${ip}`, false)
    if (!allowed) {
      return NextResponse.json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
      )
    }
  }

  // ── CSRF Protection ─────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const csrfValid = checkCsrf(request)
    if (!csrfValid) {
      return NextResponse.json({ error: 'CSRF 검증 실패' }, { status: 403 })
    }
  }

  const token = request.cookies.get('auth_token')?.value
  const jwtPayload = token ? await verifyAndDecodeJwt(token) : null
  const isAuthenticated = !!jwtPayload
  const userType = jwtPayload?.userType

  // ── Set SameSite=Strict cookie policy via response headers ──────
  const response = NextResponse.next()
  // SameSite 쿠키 정책은 Set-Cookie 헤더에 포함되므로
  // 기존 쿠키에 대해서는 API 응답 시 적용 (여기서는 CSRF 방어 헌더만 추가)
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Public routes — always allow
  if (
    pathname.startsWith('/reference/survey') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/listings') ||
    pathname.startsWith('/properties') // 공개 매물 검색
  ) {
    return response
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

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
