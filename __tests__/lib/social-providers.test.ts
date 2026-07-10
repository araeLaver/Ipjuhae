import { describe, it, expect, afterEach } from 'vitest'
import { getEnabledSocialProviders } from '@/lib/social-providers'

describe('getEnabledSocialProviders', () => {
  const originalProviders = process.env.SOCIAL_AUTH_PROVIDERS
  const originalPublicProviders = process.env.NEXT_PUBLIC_SOCIAL_AUTH_PROVIDERS

  afterEach(() => {
    if (originalProviders === undefined) {
      delete process.env.SOCIAL_AUTH_PROVIDERS
    } else {
      process.env.SOCIAL_AUTH_PROVIDERS = originalProviders
    }

    if (originalPublicProviders === undefined) {
      delete process.env.NEXT_PUBLIC_SOCIAL_AUTH_PROVIDERS
    } else {
      process.env.NEXT_PUBLIC_SOCIAL_AUTH_PROVIDERS = originalPublicProviders
    }
  })

  it('기본값은 카카오 단일 노출', () => {
    delete process.env.SOCIAL_AUTH_PROVIDERS
    delete process.env.NEXT_PUBLIC_SOCIAL_AUTH_PROVIDERS
    const providers = getEnabledSocialProviders()
    expect(providers).toEqual(['kakao'])
  })

  it('private env 기준으로 우선 적용', () => {
    process.env.SOCIAL_AUTH_PROVIDERS = 'naver,google'
    process.env.NEXT_PUBLIC_SOCIAL_AUTH_PROVIDERS = 'kakao'
    const providers = getEnabledSocialProviders()
    expect(providers).toEqual(['naver', 'google'])
  })

  it('잘못된 값은 무시하고 유효한 값만 사용', () => {
    process.env.NEXT_PUBLIC_SOCIAL_AUTH_PROVIDERS = 'apple,google,invalid,kakao'
    const providers = getEnabledSocialProviders()
    expect(providers).toEqual(['google', 'kakao'])
  })

  it('공백 제거 후 파싱', () => {
    process.env.NEXT_PUBLIC_SOCIAL_AUTH_PROVIDERS = ' naver ,  google , kakao '
    const providers = getEnabledSocialProviders()
    expect(providers).toEqual(['naver', 'google', 'kakao'])
  })
})
