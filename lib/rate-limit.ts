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

/**
 * 요청에서 IP 추출.
 *
 * `x-forwarded-for`를 먼저 보면 안 된다. 클라이언트가 이 헤더를 직접 실어 보내면
 * Fly Proxy는 **거기에 덧붙이기만** 하므로 맨 앞 값이 공격자가 고른 문자열이 된다.
 * 요청마다 다른 값을 넣으면 rate limit 키가 매번 달라져 한도가 사실상 사라진다.
 * Fly 문서도 이 헤더를 "위조 시도에 주의해 다뤄야 한다"고 못박고 `Fly-Client-IP`를
 * 권한다 — https://fly.io/docs/networking/request-headers/
 *
 * `fly-client-ip`는 Fly Proxy가 직접 채우고 클라이언트가 보낸 값은 덮어써지므로
 * 위조할 수 없다. 운영(`ipjuhae-production`)은 앞에 다른 리버스 프록시가 없어
 * (응답 헤더 `server: Fly/...`, `via: 1.1 fly.io`, Cloudflare 없음) 이 값이 곧
 * 클라이언트 IP다. **앞에 Cloudflare 같은 프록시를 두게 되면** 이 값이 그 프록시의
 * IP로 바뀌어 전원이 한 키를 공유하게 되니, 그때는 해당 프록시 전용 헤더로 다시 판단할 것.
 *
 * 아래 폴백은 로컬·테스트용이다. `fly-client-ip`가 없는 환경에서만 쓰이고,
 * 신뢰 경계 밖의 값이라는 점을 알고 쓴다.
 */
export function getClientIp(request: Request): string {
  const flyClientIp = request.headers.get('fly-client-ip')
  if (flyClientIp) return flyClientIp.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}
