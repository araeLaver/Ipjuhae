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
