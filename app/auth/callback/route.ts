import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { queryOne, query } from '@/lib/db'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { trackServer } from '@/lib/analytics'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { getBaseUrl } from '@/lib/base-url'
import { User } from '@/types/database'

const isDev = process.env.NODE_ENV === 'development'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  // 운영에서 `request.nextUrl.origin`은 공개 주소가 아니라 컨테이너 바인드 주소
  // (`https://0.0.0.0:8000`)로 잡힌다. 그 값으로 Location을 만들면 매직 링크로
  // 로그인한 사용자가 닿을 수 없는 주소로 튕긴다. 소셜 콜백과 같은 단일 지점을 쓴다.
  const origin = getBaseUrl()
  const code = searchParams.get('code')
  // 로그인 화면이 매직 링크에 실어 보낸 복귀 자리. 메일에서 열린 주소라 외부 값과
  // 다를 바 없으므로 같은 사이트 경로인지 반드시 다시 검증한다.
  const redirectTo = safeRedirectPath(searchParams.get('redirect'))

  if (!code) {
    if (isDev) logger.info('[auth/callback] No code parameter — redirecting to login')
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !data.user?.email) {
      logger.error('Magic link auth error', { error: error?.message })
      return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
    }

    const email = data.user.email
    if (isDev) logger.info('[auth/callback] Authenticated email', { email })

    // Check if user already exists in local DB
    let user = await queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    let isNewUser = false

    if (!user) {
      // Create new user via magic link signup
      isNewUser = true
      const rows = await query<User>(
        `INSERT INTO users (email, user_type, auth_provider)
         VALUES ($1, 'tenant', 'magic_link')
         RETURNING *`,
        [email]
      )
      user = rows[0]
      if (isDev) logger.info('[auth/callback] New user created', { userId: user.id })
    }

    // Generate app JWT and set cookie
    const token = generateToken(user.id, user.user_type)
    await setAuthCookie(token)

    // Track user_signup for new users
    if (isNewUser) {
      await trackServer('user_signup', {
        userId: user.id,
        properties: { method: 'magic_link', email },
      })
      if (isDev) logger.info('[auth/callback] New user → redirecting to /onboarding/basic')
      return NextResponse.redirect(new URL('/onboarding/basic', origin))
    }

    // 신규 가입은 위에서 온보딩으로 보냈다. 여기는 기존 사용자이므로 원래 가려던 자리가
    // 있으면 그쪽이 우선이다.
    const destination =
      redirectTo ??
      (user.user_type === 'landlord' ? '/landlord' :
       user.user_type === 'admin' ? '/admin' : '/profile')
    if (isDev) logger.info('[auth/callback] Existing user → redirecting to', { destination })
    return NextResponse.redirect(new URL(destination, origin))
  } catch (err) {
    logger.error('Auth callback error', { error: err })
    return NextResponse.redirect(new URL('/login?error=server_error', origin))
  }
}
