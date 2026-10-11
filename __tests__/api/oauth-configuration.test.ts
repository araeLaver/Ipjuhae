import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as start } from '@/app/api/auth/social/[provider]/route'
import { GET as providers } from '@/app/api/auth/providers/route'
import { exchangeCode, getAuthorizeUrl } from '@/lib/oauth'

const names = ['kakao', 'naver', 'google'] as const
beforeEach(() => {
  for (const name of names) {
    vi.stubEnv(`${name.toUpperCase()}_CLIENT_ID`, '')
    vi.stubEnv(`${name.toUpperCase()}_CLIENT_SECRET`, '')
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each(names)('%s OAuth 설정', (provider) => {
  it.each([
    ['', ''], ['test-client', ''], ['', 'test-secret'], ['  ', 'test-secret'], ['test-client', '  '],
  ])('필수 설정 누락 시 노출과 리다이렉트를 함께 차단한다 (%s, %s)', async (id, secret) => {
    vi.stubEnv(`${provider.toUpperCase()}_CLIENT_ID`, id)
    vi.stubEnv(`${provider.toUpperCase()}_CLIENT_SECRET`, secret)
    expect((await (await providers()).json()).providers).not.toContain(provider)
    const response = await start(new Request(`http://localhost/api/auth/social/${provider}`), {
      params: Promise.resolve({ provider }),
    })
    expect(response.status).toBe(503)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(console.warn).toHaveBeenCalledWith('OAuth provider unavailable', {
      provider, clientIdPresent: Boolean(id.trim()), clientSecretPresent: Boolean(secret.trim()),
    })
    expect(() => getAuthorizeUrl(provider, 'state')).toThrow('OAuth configuration missing')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(exchangeCode(provider, 'code')).rejects.toThrow('OAuth configuration missing')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('설정 완료 시 노출하고 정상 authorize URL과 state 쿠키를 생성한다', async () => {
    vi.stubEnv(`${provider.toUpperCase()}_CLIENT_ID`, 'test-client')
    vi.stubEnv(`${provider.toUpperCase()}_CLIENT_SECRET`, 'test-secret')
    expect((await (await providers()).json()).providers).toEqual([provider])
    const response = await start(new Request(`http://localhost/api/auth/social/${provider}`), {
      params: Promise.resolve({ provider }),
    })
    expect(response.status).toBe(307)
    const url = new URL(response.headers.get('location')!)
    expect(url.searchParams.get('client_id')).toBe('test-client')
    expect(url.searchParams.get('client_secret')).toBeNull()
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(response.headers.get('set-cookie')).toContain('oauth_state=')
    expect(console.warn).not.toHaveBeenCalled()
  })
})

it('지원하지 않는 provider는 400으로 거절한다', async () => {
  const response = await start(new Request('http://localhost/api/auth/social/unknown'), {
    params: Promise.resolve({ provider: 'unknown' }),
  })
  expect(response.status).toBe(400)
})
