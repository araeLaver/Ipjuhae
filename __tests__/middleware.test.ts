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
