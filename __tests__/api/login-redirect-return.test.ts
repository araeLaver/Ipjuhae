import { NextRequest } from 'next/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * DOW-1168 — "권한 없는 페이지 → 로그인 → 원래 목적지 복귀"가 로그인 수단 전체에서 되는가.
 *
 * 비밀번호 로그인만 `?redirect=`를 읽고 있었고, 매직 링크와 소셜은 목적지를 버리고
 * `/profile`로 보냈다. 403 화면에서 "로그인하고 이어서 보기"를 누른 사람이 카카오를
 * 고르면 원래 글로 돌아오지 못했다는 뜻이다. 그 왕복을 여기서 고정한다.
 */

vi.mock('@/lib/db', () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  generateToken: vi.fn(() => 'jwt-token'),
  setAuthCookie: vi.fn(async () => undefined),
}))

vi.mock('@/lib/oauth', () => ({
  generateState: vi.fn(() => 'state-uuid'),
  getAuthorizeUrl: vi.fn(() => 'https://kauth.kakao.com/oauth/authorize?state=state-uuid'),
  exchangeCode: vi.fn(async () => 'access-token'),
  getProfile: vi.fn(async () => ({ id: 'kakao-1', email: 'a@example.com', name: '테스터' })),
}))

vi.mock('@/lib/analytics', () => ({ trackServer: vi.fn(async () => undefined) }))

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: vi.fn(async () => ({
        data: { user: { email: 'a@example.com' } },
        error: null,
      })),
    },
  })),
}))

import { GET as socialStart } from '@/app/api/auth/social/[provider]/route'
import { GET as socialCallback } from '@/app/api/auth/social/[provider]/callback/route'
import { GET as magicCallback } from '@/app/auth/callback/route'
import { queryOne } from '@/lib/db'

const kakaoParams = Promise.resolve({ provider: 'kakao' })

function locationOf(res: Response): URL {
  return new URL(res.headers.get('location') ?? '')
}

/**
 * 응답이 실제로 심는 쿠키 값. 지우기(빈 값 + 만료)는 값이 없는 것으로 본다 —
 * 브라우저에 남는 결과가 "없음"이라 시험에서도 같게 취급해야 한다.
 */
function setCookieValue(res: Response, name: string): string | null {
  const raw = res.headers.get('set-cookie') ?? ''
  for (const part of raw.split(/,(?=[^;]+?=)/)) {
    const match = part.trim().match(new RegExp(`^${name}=([^;]*)`))
    if (!match) continue
    return match[1] ? decodeURIComponent(match[1]) : null
  }
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
})

describe('소셜 로그인 시작 — 복귀 자리를 왕복시킨다', () => {
  it('같은 사이트 경로면 oauth_redirect 쿠키에 담는다', async () => {
    const res = await socialStart(
      new Request('http://localhost:3000/api/auth/social/kakao?redirect=%2Fcommunity%2Fabc'),
      { params: kakaoParams }
    )
    expect(setCookieValue(res, 'oauth_redirect')).toBe('/community/abc')
  })

  it('//host 같은 외부 주소는 담지 않는다', async () => {
    const res = await socialStart(
      new Request('http://localhost:3000/api/auth/social/kakao?redirect=%2F%2Fevil.example'),
      { params: kakaoParams }
    )
    expect(setCookieValue(res, 'oauth_redirect')).toBeNull()
  })
})

describe('소셜 로그인 콜백 — 맡겨둔 자리로 돌려보낸다', () => {
  function callbackRequest(cookies: Record<string, string>): NextRequest {
    const req = new NextRequest(
      'http://localhost:3000/api/auth/social/kakao/callback?code=c1&state=state-uuid'
    )
    for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v)
    return req
  }

  it('기존 사용자를 원래 보던 글로 돌려보낸다', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'u1', user_type: 'tenant' })

    const res = await socialCallback(
      callbackRequest({ oauth_state: 'state-uuid', oauth_redirect: '/community/abc' }),
      { params: kakaoParams }
    )

    expect(locationOf(res).pathname).toBe('/community/abc')
  })

  it('복귀 자리가 없으면 기존대로 /profile로 보낸다', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'u1', user_type: 'tenant' })

    const res = await socialCallback(
      callbackRequest({ oauth_state: 'state-uuid' }),
      { params: kakaoParams }
    )

    expect(locationOf(res).pathname).toBe('/profile')
  })

  it('쿠키가 조작돼 외부 주소가 들어와도 따라가지 않는다', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'u1', user_type: 'tenant' })

    const res = await socialCallback(
      callbackRequest({ oauth_state: 'state-uuid', oauth_redirect: '//evil.example' }),
      { params: kakaoParams }
    )

    const location = locationOf(res)
    expect(location.host).toBe('localhost:3000')
    expect(location.pathname).toBe('/profile')
  })
})

describe('매직 링크 콜백 — 메일에 실어 보낸 자리로 돌려보낸다', () => {
  it('기존 사용자를 redirect 파라미터의 자리로 보낸다', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'u1', user_type: 'tenant' })

    const res = await magicCallback(
      new NextRequest('http://localhost:3000/auth/callback?code=c1&redirect=%2Fcommunity%2Fabc')
    )

    expect(locationOf(res).pathname).toBe('/community/abc')
  })

  it('외부 주소는 무시하고 역할 기본 화면으로 보낸다', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'u2', user_type: 'landlord' })

    const res = await magicCallback(
      new NextRequest('http://localhost:3000/auth/callback?code=c1&redirect=%2F%2Fevil.example')
    )

    const location = locationOf(res)
    expect(location.host).toBe('localhost:3000')
    expect(location.pathname).toBe('/landlord')
  })
})

/**
 * 운영 실측(2026-09-26)에서 `/auth/callback`의 Location이
 * `https://0.0.0.0:8000/login?error=missing_code`로 나갔다. `request.nextUrl.origin`이
 * 공개 주소가 아니라 컨테이너 바인드 주소로 잡히기 때문이다. 매직 링크로 로그인한
 * 사람은 닿을 수 없는 주소로 튕긴다 — 복귀 자리를 옳게 골라도 도착을 못 한다.
 *
 * 위 시험들은 요청 호스트와 `NEXT_PUBLIC_BASE_URL`이 똑같이 localhost:3000이라
 * 이 어긋남을 볼 수 없었다. 그래서 여기서는 둘을 일부러 다르게 둔다.
 */
describe('매직 링크 콜백 — 공개 주소로 돌려보낸다 (내부 바인드 주소 금지)', () => {
  const internalOrigin = 'https://0.0.0.0:8000'

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.ipjuhae.com'
  })

  it('code가 없을 때도 공개 주소의 /login으로 보낸다', async () => {
    const res = await magicCallback(new NextRequest(`${internalOrigin}/auth/callback`))

    const location = locationOf(res)
    expect(location.host).toBe('www.ipjuhae.com')
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('missing_code')
  })

  it('복귀 자리로 보낼 때도 호스트는 공개 주소다', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'u3', user_type: 'tenant' })

    const res = await magicCallback(
      new NextRequest(`${internalOrigin}/auth/callback?code=c1&redirect=%2Fcommunity%2Fabc`)
    )

    const location = locationOf(res)
    expect(location.host).toBe('www.ipjuhae.com')
    expect(location.pathname).toBe('/community/abc')
  })
})
