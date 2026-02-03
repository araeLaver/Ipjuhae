import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { exchangeCode, getProfile } from '@/lib/oauth'
import { AuthProvider, User } from '@/types/database'

const VALID_PROVIDERS: AuthProvider[] = ['kakao', 'naver', 'google']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (!VALID_PROVIDERS.includes(provider as AuthProvider)) {
    return NextResponse.redirect(`${base}/login?error=invalid_provider`)
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${base}/login?error=oauth_denied`)
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
      return NextResponse.redirect(`${base}/profile`)
    }

    // 이메일로 기존 계정 있는지 확인
    if (profile.email) {
      const emailUser = await queryOne<User>(
        'SELECT * FROM users WHERE email = $1',
        [profile.email]
      )

      if (emailUser) {
        return NextResponse.redirect(
          `${base}/login?error=email_exists&provider=${provider}`
        )
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

    return NextResponse.redirect(`${base}/signup/social?${signupParams.toString()}`)
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${base}/login?error=oauth_failed`)
  }
}
