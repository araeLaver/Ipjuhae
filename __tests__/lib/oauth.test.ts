import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateState, getAuthorizeUrl, getProfile } from '@/lib/oauth'

describe('generateState', () => {
  it('UUID 형태의 문자열을 반환한다', () => {
    const state = generateState()
    expect(state).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })

  it('호출마다 고유한 값을 반환한다', () => {
    const states = new Set(Array.from({ length: 10 }, generateState))
    expect(states.size).toBe(10)
  })
})

describe('getAuthorizeUrl', () => {
  const state = 'test-state-uuid'

  it('카카오 authorize URL에 client_id와 state가 포함된다', () => {
    process.env.KAKAO_CLIENT_ID = 'kakao-test-id'
    const url = new URL(getAuthorizeUrl('kakao', state))
    expect(url.origin + url.pathname).toBe('https://kauth.kakao.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('kakao-test-id')
    expect(url.searchParams.get('state')).toBe(state)
    expect(url.searchParams.get('response_type')).toBe('code')
  })

  it('네이버 authorize URL에 client_id와 state가 포함된다', () => {
    process.env.NAVER_CLIENT_ID = 'naver-test-id'
    const url = new URL(getAuthorizeUrl('naver', state))
    expect(url.origin + url.pathname).toBe('https://nid.naver.com/oauth2.0/authorize')
    expect(url.searchParams.get('client_id')).toBe('naver-test-id')
    expect(url.searchParams.get('state')).toBe(state)
  })

  it('카카오 URL에 scope가 포함된다', () => {
    const url = new URL(getAuthorizeUrl('kakao', state))
    expect(url.searchParams.get('scope')).toBe('profile_nickname profile_image account_email')
  })

  it('네이버 URL에 scope가 포함되지 않는다 (빈 문자열)', () => {
    const url = new URL(getAuthorizeUrl('naver', state))
    expect(url.searchParams.has('scope')).toBe(false)
  })
})

describe('getProfile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('카카오 응답을 SocialProfile로 정규화한다', async () => {
    const kakaoResponse = {
      id: 123456789,
      kakao_account: {
        email: 'test@kakao.com',
        profile: {
          nickname: '카카오유저',
          profile_image_url: 'https://profile.kakao.com/image.jpg',
        },
      },
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => kakaoResponse,
    } as Response)

    const profile = await getProfile('kakao', 'dummy-token')
    expect(profile.id).toBe('123456789')
    expect(profile.email).toBe('test@kakao.com')
    expect(profile.name).toBe('카카오유저')
    expect(profile.profileImage).toBe('https://profile.kakao.com/image.jpg')
  })

  it('네이버 응답을 SocialProfile로 정규화한다', async () => {
    const naverResponse = {
      response: {
        id: 'naver-user-id',
        email: 'test@naver.com',
        name: '네이버유저',
        profile_image: 'https://ssl.pstatic.net/image.jpg',
      },
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => naverResponse,
    } as Response)

    const profile = await getProfile('naver', 'dummy-token')
    expect(profile.id).toBe('naver-user-id')
    expect(profile.email).toBe('test@naver.com')
    expect(profile.name).toBe('네이버유저')
    expect(profile.profileImage).toBe('https://ssl.pstatic.net/image.jpg')
  })

  it('카카오 이메일 없는 경우 null 반환', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 999,
        kakao_account: { profile: { nickname: '닉네임' } },
      }),
    } as Response)

    const profile = await getProfile('kakao', 'token')
    expect(profile.email).toBeNull()
  })

  it('fetch 실패 시 에러를 던진다', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    await expect(getProfile('kakao', 'bad-token')).rejects.toThrow('Profile fetch failed: 401')
  })
})
