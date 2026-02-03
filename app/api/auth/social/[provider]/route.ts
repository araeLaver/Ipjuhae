import { NextResponse } from 'next/server'
import { AuthProvider } from '@/types/database'
import { getAuthorizeUrl } from '@/lib/oauth'

const VALID_PROVIDERS: AuthProvider[] = ['kakao', 'naver', 'google']

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params

  if (!VALID_PROVIDERS.includes(provider as AuthProvider)) {
    return NextResponse.json({ error: '지원하지 않는 로그인 방식입니다' }, { status: 400 })
  }

  const url = getAuthorizeUrl(provider as AuthProvider)
  return NextResponse.redirect(url)
}
