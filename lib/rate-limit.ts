/**
 * 간단한 인메모리 Rate Limiter
 * 프로덕션에서는 Redis 기반으로 교체 권장
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// 오래된 항목 주기적 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  })
}, 60_000)

interface RateLimitConfig {
  /** 윈도우당 허용 요청 수 */
  limit: number
  /** 윈도우 크기 (밀리초) */
  windowMs: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { success: true, remaining: config.limit - 1, resetAt }
  }

  if (entry.count >= config.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
}

/** 인증 관련 엔드포인트용 (분당 10회) */
export function authRateLimit(ip: string): RateLimitResult {
  return rateLimit(`auth:${ip}`, { limit: 10, windowMs: 60_000 })
}

/** 일반 API 엔드포인트용 (분당 60회) */
export function apiRateLimit(ip: string): RateLimitResult {
  return rateLimit(`api:${ip}`, { limit: 60, windowMs: 60_000 })
}

/** 요청에서 IP 추출 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}
