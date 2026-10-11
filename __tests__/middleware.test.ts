import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { middleware } from '@/middleware'

function apiMutation(url: string, origin: string, host: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      origin,
      host,
    },
  })
}

describe('middleware CSRF origin checks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows production same-origin mutations across www and apex hosts', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.ipjuhae.com')

    const response = await middleware(
      apiMutation('https://ipjuhae.com/api/auth/signup', 'https://www.ipjuhae.com', 'ipjuhae.com')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('rejects production cross-origin mutations', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.ipjuhae.com')

    const response = await middleware(
      apiMutation('https://ipjuhae.com/api/auth/signup', 'https://attacker.example', 'ipjuhae.com')
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.code).toBe('CSRF_INVALID')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

/**
 * DOW-1168 — 로그인 후 원래 목적지 복귀.
 *
 * 미들웨어가 `?redirect=`를 붙이는 쪽이라 여기서 값이 망가지면 로그인 화면이
 * 아무리 잘 받아도 복귀가 안 된다.
 */
describe('middleware 보호 경로 로그인 리다이렉트', () => {
  it('원래 경로를 쿼리스트링까지 redirect 값에 담는다', async () => {
    const response = await middleware(
      new NextRequest('https://www.ipjuhae.com/landlord/properties?tab=active')
    )

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location') ?? '')
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('redirect')).toBe('/landlord/properties?tab=active')
  })

  it('원래 페이지의 쿼리를 /login 자체 파라미터로 흘리지 않는다', async () => {
    const response = await middleware(
      new NextRequest('https://www.ipjuhae.com/profile?error=oauth_denied')
    )

    const location = new URL(response.headers.get('location') ?? '')
    // `error`가 그대로 얹히면 로그인 화면이 있지도 않은 실패를 토스트로 띄운다.
    expect(location.searchParams.get('error')).toBeNull()
    expect(location.searchParams.get('redirect')).toBe('/profile?error=oauth_denied')
  })
})

describe('워처 핑 CSRF 예외 범위', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('Origin 없는 POST 핑은 라우트의 별도 Bearer 인증으로 전달한다', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = await middleware(new NextRequest('https://www.ipjuhae.com/api/ops/heartbeat', { method: 'POST' }))
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
  it('다른 메서드와 인접 경로는 예외로 열지 않는다', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    for (const [path, method] of [['/api/ops/heartbeat', 'DELETE'], ['/api/ops/heartbeat/other', 'POST'], ['/api/profile', 'POST']]) {
      const response = await middleware(new NextRequest(`https://www.ipjuhae.com${path}`, { method }))
      expect(response.status).toBe(403)
    }
  })
})


describe('OAuth 시작 rate limit 복구', () => {
  it('한도를 소진한 HTML 진입만 복구하고 API 429와 한도를 유지한다', async () => {
    const headers = { 'fly-client-ip': '192.0.2.151' }
    for (let i = 0; i < 10; i++) {
      expect((await middleware(new NextRequest('http://localhost/api/auth/providers', { headers }))).status).toBe(200)
    }
    for (const provider of ['kakao', 'naver', 'google']) {
      const response = await middleware(new NextRequest(`http://localhost/api/auth/social/${provider}?redirect=%2Fcommunity%3Ftab%3Dlatest`, {
        headers: { ...headers, accept: 'text/html,application/xhtml+xml' },
      }))
      expect(response.status).toBe(303)
      const location = new URL(response.headers.get('location')!)
      expect(location.origin).toBe('http://localhost')
      expect(location.pathname).toBe('/login')
      expect(location.searchParams.get('error')).toBe('oauth_unavailable')
      expect(location.searchParams.get('redirect')).toBe('/community?tab=latest')
      expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
      expect(response.headers.get('vary')).toBe('Accept')
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('x-request-id')).toBeTruthy()
      expect(response.headers.get('x-trace-id')).toBeTruthy()
      expect(response.headers.get('set-cookie')).toBeNull()
    }
    for (const redirect of ['https://evil.example', '//evil.example', '/\\evil.example', '/bad\npath']) {
      const response = await middleware(new NextRequest(`http://localhost/api/auth/social/kakao?redirect=${encodeURIComponent(redirect)}`, { headers: { ...headers, accept: 'text/html' } }))
      expect(new URL(response.headers.get('location')!).searchParams.has('redirect')).toBe(false)
    }
    for (const [path, accept, method] of [
      ['/api/auth/social/kakao', 'application/json', 'GET'],
      ['/api/auth/social/kakao', '*/*', 'GET'],
      ['/api/auth/social/kakao', 'text/html', 'POST'],
      ['/api/auth/providers', 'text/html', 'GET'],
      ['/api/auth/social/kakao/callback', 'text/html', 'GET'],
    ]) {
      const response = await middleware(new NextRequest(`http://localhost${path}`, { method, headers: { ...headers, accept } }))
      expect(response.status).toBe(429)
      expect((await response.json()).code).toBe('RATE_LIMIT_EXCEEDED')
      expect(response.headers.get('location')).toBeNull()
      expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0)
    }
  })
})
