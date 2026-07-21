import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getRequestContext } from '@/lib/request-context'
import { isJwtStrictMode, verifyJwtToken } from '@/lib/jwt'

async function verifyAndDecodeJwt(
  token: string
): Promise<{ userId: string; userType?: string } | null> {
  try {
    const strictMode = isJwtStrictMode()
    const payload = await verifyJwtToken(token, {
      strict: strictMode,
      requireJti: strictMode,
    })
    if (payload) {
      return { userId: payload.userId, userType: payload.userType }
    }
    if (strictMode) return null

    const fallback = await verifyJwtToken(token, {
      strict: false,
    })
    if (!fallback) return null
    return { userId: fallback.userId, userType: fallback.userType }
  } catch {
    return null
  }
}

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

function checkCsrf(request: NextRequest): boolean {
  const method = request.method
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  if (!isMutation) return true

  if (request.headers.get('x-mobile-client') === 'true') {
    return true
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

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
  const { requestId, traceId } = getRequestContext(request)

  if (request.headers.get('next-action')) {
    const blocked = NextResponse.json(
      { error: 'Server Actions are not supported', request_id: requestId, trace_id: traceId },
      { status: 400 }
    )
    blocked.headers.set('x-request-id', requestId)
    blocked.headers.set('x-trace-id', traceId)
    blocked.headers.set('Retry-After', '0')
    blocked.headers.set('Cache-Control', 'no-store')
    return blocked
  }

  if (pathname.startsWith('/api/auth')) {
    const { allowed, retryAfter } = await checkRateLimit(`auth:${ip}`, true)
    if (!allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          request_id: requestId,
          trace_id: traceId,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
      )
      response.headers.set('x-request-id', requestId)
      response.headers.set('x-trace-id', traceId)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
  } else if (pathname.startsWith('/api/')) {
    const { allowed, retryAfter } = await checkRateLimit(`api:${ip}`, false)
    if (!allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          request_id: requestId,
          trace_id: traceId,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
      )
      response.headers.set('x-request-id', requestId)
      response.headers.set('x-trace-id', traceId)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
  }

  if (pathname.startsWith('/api/')) {
    const csrfValid = checkCsrf(request)
    if (!csrfValid) {
      const response = NextResponse.json(
        {
          error: 'Invalid CSRF token',
          code: 'CSRF_INVALID',
          request_id: requestId,
          trace_id: traceId,
        },
        { status: 403 }
      )
      response.headers.set('x-request-id', requestId)
      response.headers.set('x-trace-id', traceId)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
  }

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
  const cookieToken = request.cookies.get('auth_token')?.value
  const token = bearerToken || cookieToken

  const jwtPayload = token ? await verifyAndDecodeJwt(token) : null
  const isAuthenticated = !!jwtPayload
  const userType = jwtPayload?.userType

  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-trace-id', traceId)
  response.headers.set('Cache-Control', 'no-store')

  if (
    pathname.startsWith('/reference/survey') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/listings') ||
    pathname.startsWith('/properties')
  ) {
    return response
  }

  const protectedPrefixes = ['/profile', '/onboarding', '/landlord', '/admin', '/verify-phone']
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix))

  if (isProtected && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    redirectResponse.headers.set('x-request-id', requestId)
    redirectResponse.headers.set('x-trace-id', traceId)
    return redirectResponse
  }

  if (pathname.startsWith('/admin') && userType !== 'admin') {
    const redirectResponse = NextResponse.redirect(new URL('/', request.url))
    redirectResponse.headers.set('x-request-id', requestId)
    redirectResponse.headers.set('x-trace-id', traceId)
    return redirectResponse
  }

  if (pathname.startsWith('/landlord') && userType !== 'landlord' && userType !== 'admin') {
    const redirectResponse = NextResponse.redirect(new URL('/profile', request.url))
    redirectResponse.headers.set('x-request-id', requestId)
    redirectResponse.headers.set('x-trace-id', traceId)
    return redirectResponse
  }

  if (pathname.startsWith('/onboarding') && userType === 'landlord') {
    const redirectResponse = NextResponse.redirect(new URL('/landlord/onboarding', request.url))
    redirectResponse.headers.set('x-request-id', requestId)
    redirectResponse.headers.set('x-trace-id', traceId)
    return redirectResponse
  }

  const authPages = ['/login', '/signup']
  const isAuthPage = authPages.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (isAuthPage && isAuthenticated) {
    const destination =
      userType === 'landlord' ? '/landlord' : userType === 'admin' ? '/admin' : '/profile'
    const redirectResponse = NextResponse.redirect(new URL(destination, request.url))
    redirectResponse.headers.set('x-request-id', requestId)
    redirectResponse.headers.set('x-trace-id', traceId)
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
