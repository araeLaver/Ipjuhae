import { NextResponse } from 'next/server'
import { AuthProvider } from '@/types/database'
import { generateState, getAuthorizeUrl } from '@/lib/oauth'

const VALID_PROVIDERS: AuthProvider[] = ['kakao', 'naver', 'google']
const STATE_COOKIE = 'oauth_state'
const STATE_MAX_AGE = 300 // 5 minutes

export async function GET(
  _request: Request,
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

  return response
}
