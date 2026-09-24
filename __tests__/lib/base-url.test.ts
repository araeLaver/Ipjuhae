/**
 * base URL 정규화 회귀 테스트 (DOW-1193).
 *
 * 막으려는 것: `NEXT_PUBLIC_BASE_URL`에 끝 슬래시가 하나 붙는 순간 주소를 이어 붙이는
 * 모든 곳이 `//`가 되는 것. 그중 `lib/oauth.ts`의 `redirect_uri`가 어긋나면 소셜 로그인
 * 전체가 실패하고, `lib/email.ts`가 만든 링크는 이미 발송돼 되돌릴 수 없다.
 *
 * 그래서 "정규화 함수가 잘 도는가"만 보지 않는다. **실제 호출부가 만드는 최종 문자열**을
 * 끝 슬래시가 붙은 값으로 확인한다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildUrl, getBaseUrl, normalizeBaseUrl } from '@/lib/base-url'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('normalizeBaseUrl', () => {
  it('끝 슬래시를 제거한다', () => {
    expect(normalizeBaseUrl('https://www.ipjuhae.com/')).toBe('https://www.ipjuhae.com')
  })

  it('슬래시가 여러 개여도 전부 제거한다', () => {
    expect(normalizeBaseUrl('https://www.ipjuhae.com///')).toBe('https://www.ipjuhae.com')
  })

  it('슬래시가 없으면 값을 그대로 둔다', () => {
    expect(normalizeBaseUrl('https://www.ipjuhae.com')).toBe('https://www.ipjuhae.com')
  })

  it('경로가 있는 base도 끝 슬래시만 떼고 경로는 보존한다', () => {
    expect(normalizeBaseUrl('https://x.com/app/')).toBe('https://x.com/app')
  })

  it('비어 있거나 공백이면 폴백을 쓴다', () => {
    expect(normalizeBaseUrl('')).toBe('http://localhost:3000')
    expect(normalizeBaseUrl('   ')).toBe('http://localhost:3000')
    expect(normalizeBaseUrl(undefined)).toBe('http://localhost:3000')
    expect(normalizeBaseUrl(null)).toBe('http://localhost:3000')
  })

  it('폴백 자체에 끝 슬래시가 있어도 정규화한다', () => {
    expect(normalizeBaseUrl(undefined, 'https://www.ipjuhae.com/')).toBe('https://www.ipjuhae.com')
  })
})

describe('buildUrl — 끝 슬래시가 붙어도 `//`를 만들지 않는다', () => {
  it('env에 끝 슬래시가 있어도 경로가 하나의 슬래시로 이어진다', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://www.ipjuhae.com/')

    expect(buildUrl('login')).toBe('https://www.ipjuhae.com/login')
    expect(buildUrl('/login')).toBe('https://www.ipjuhae.com/login')
  })

  it('경로 앞 슬래시 유무와 무관하게 같은 결과를 준다', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://www.ipjuhae.com')

    expect(buildUrl('profile/verifications')).toBe(buildUrl('/profile/verifications'))
  })

  it('빈 경로면 base만 돌려준다', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://www.ipjuhae.com/')

    expect(buildUrl('')).toBe('https://www.ipjuhae.com')
  })

  it('env를 호출 시점에 읽는다 — 모듈 로드 시점에 굳지 않는다', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://first.example.com/')
    expect(getBaseUrl()).toBe('https://first.example.com')

    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://second.example.com/')
    expect(getBaseUrl()).toBe('https://second.example.com')
  })
})

describe('OAuth redirect_uri — 소셜 로그인이 걸린 지점', () => {
  async function redirectUriFor(provider: 'kakao' | 'naver' | 'google') {
    const { getAuthorizeUrl } = await import('@/lib/oauth')
    // authorize URL의 query에서 redirect_uri를 되읽는다. 내부 함수가 아니라
    // 실제로 provider에 보내지는 값을 본다.
    const url = new URL(getAuthorizeUrl(provider, 'state-123'))
    return url.searchParams.get('redirect_uri')
  }

  it('끝 슬래시가 없을 때 수정 전과 바이트 단위로 같은 값을 만든다', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://www.ipjuhae.com')
    vi.stubEnv('KAKAO_CLIENT_ID', 'test-kakao')

    // 수정 전 표현식: `${base}/api/auth/social/${provider}/callback`
    const before = 'https://www.ipjuhae.com' + '/api/auth/social/kakao/callback'

    expect(await redirectUriFor('kakao')).toBe(before)
  })

  it('끝 슬래시가 붙어도 `//`가 생기지 않는다 — 콘솔 등록값과 계속 일치한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://www.ipjuhae.com/')
    vi.stubEnv('KAKAO_CLIENT_ID', 'test-kakao')

    const uri = await redirectUriFor('kakao')

    expect(uri).toBe('https://www.ipjuhae.com/api/auth/social/kakao/callback')
    expect(uri).not.toContain('//api')
  })
})

describe('환경변수에 끝 슬래시가 붙어도 어떤 조합에서도 `//`가 남지 않는다', () => {
  const paths = [
    'login',
    '/login',
    'profile',
    'profile/verifications',
    'invite/token-abc',
    'reference/survey/token-abc',
    'mock-storage/uploads/a.png',
    'api/admin/users/42',
    'api/auth/social/naver/callback',
  ]

  for (const value of ['https://www.ipjuhae.com', 'https://www.ipjuhae.com/', 'https://www.ipjuhae.com//']) {
    it(`base='${value}' 에서 전부 단일 슬래시`, () => {
      vi.stubEnv('NEXT_PUBLIC_BASE_URL', value)

      for (const p of paths) {
        const built = buildUrl(p)
        // scheme의 `//`는 제외하고 검사한다
        expect(built.slice('https://'.length), `${p} → ${built}`).not.toContain('//')
        expect(built.startsWith('https://www.ipjuhae.com/')).toBe(true)
      }
    })
  }
})
