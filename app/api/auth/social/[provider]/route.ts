import { NextResponse } from 'next/server'
import { AuthProvider } from '@/types/database'
import { generateState, getAuthorizeUrl } from '@/lib/oauth'
import { safeRedirectPath } from '@/lib/safe-redirect'

const VALID_PROVIDERS: AuthProvider[] = ['kakao', 'naver', 'google']
const STATE_COOKIE = 'oauth_state'
const REDIRECT_COOKIE = 'oauth_redirect'
const STATE_MAX_AGE = 300 // 5 minutes

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params

  if (!VALID_PROVIDERS.includes(provider as AuthProvider)) {
    return NextResponse.json({ error: '지원하지 않는 로그인 방식입니다' }, { status: 400 })
  }

  const state = generateState()
  const url = getAuthorizeUrl(provider as AuthProvider, state)

  const response = NextResponse.redirect(url)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: STATE_MAX_AGE,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })

  // 로그인 후 복귀할 자리를 쿠키에 맡긴다. OAuth 제공자를 거쳐 돌아올 때는
  // 우리가 붙인 쿼리스트링이 남지 않으므로 state와 같은 수명으로 함께 왕복시킨다.
  const redirectTo = safeRedirectPath(new URL(request.url).searchParams.get('redirect'))
  if (redirectTo) {
    response.cookies.set(REDIRECT_COOKIE, redirectTo, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: STATE_MAX_AGE,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })
  } else {
    // 앞선 시도에서 남은 값이 엉뚱한 곳으로 보내지 않도록 지운다.
    response.cookies.delete(REDIRECT_COOKIE)
  }

  return response
}
