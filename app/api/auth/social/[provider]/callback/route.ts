import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { exchangeCode, getProfile } from '@/lib/oauth'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { AuthProvider, User } from '@/types/database'
import { getBaseUrl } from '@/lib/base-url'

const VALID_PROVIDERS: AuthProvider[] = ['kakao', 'naver', 'google']
const STATE_COOKIE = 'oauth_state'
const REDIRECT_COOKIE = 'oauth_redirect'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const base = getBaseUrl()

  const redirectTo = safeRedirectPath(request.cookies.get(REDIRECT_COOKIE)?.value)
  const clearState = (res: NextResponse) => {
    res.cookies.delete(STATE_COOKIE)
    res.cookies.delete(REDIRECT_COOKIE)
    return res
  }
  const loginError = (error: string, includeProvider = false) => {
    const login = new URL('/login', base)
    login.searchParams.set('error', error)
    if (redirectTo) login.searchParams.set('redirect', redirectTo)
    if (includeProvider) login.searchParams.set('provider', provider)
    return clearState(NextResponse.redirect(login))
  }

  if (!VALID_PROVIDERS.includes(provider as AuthProvider)) {
    return loginError('invalid_provider')
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  if (error || !code) return loginError('oauth_denied')

  // CSRF state 검증은 token 교환 전에 유지한다.
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value
  if (!stateCookie || !stateParam || stateCookie !== stateParam) {
    return loginError('state_mismatch')
  }

  try {
    const accessToken = await exchangeCode(provider as AuthProvider, code)
    const profile = await getProfile(provider as AuthProvider, accessToken)

    // 기존 소셜 유저 조회
    const existingUser = await queryOne<User>(
      'SELECT * FROM users WHERE auth_provider = $1 AND auth_provider_id = $2',
      [provider, profile.id]
    )

    if (existingUser) {
      // 기존 유저 → 바로 로그인
      const token = generateToken(existingUser.id)
      await setAuthCookie(token)
      return clearState(NextResponse.redirect(new URL(redirectTo ?? '/profile', base)))
    }

    // 이메일로 기존 계정 있는지 확인
    if (profile.email) {
      const emailUser = await queryOne<User>(
        'SELECT * FROM users WHERE email = $1',
        [profile.email]
      )

      if (emailUser) {
        return loginError('email_exists', true)
      }
    }

    // 신규 유저 → 소셜 가입 페이지로 이동
    const signupParams = new URLSearchParams({
      provider,
      providerId: profile.id,
      ...(profile.email && { email: profile.email }),
      ...(profile.name && { name: profile.name }),
      ...(profile.profileImage && { profileImage: profile.profileImage }),
    })

    return clearState(NextResponse.redirect(`${base}/signup/social?${signupParams.toString()}`))
  } catch (err) {
    logger.error('OAuth callback error', { error: err })
    return loginError('oauth_failed')
  }
}
