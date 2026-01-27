import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 인증이 필요한 세입자 라우트
  const tenantProtectedRoutes = ['/profile', '/onboarding']

  // 인증이 필요한 집주인 라우트
  const landlordProtectedRoutes = ['/landlord']

  // 레퍼런스 설문 페이지는 인증 불필요 (public)
  if (pathname.startsWith('/reference/survey')) {
    return NextResponse.next()
  }

  // 인증 확인은 각 API 라우트와 페이지 컴포넌트에서 처리
  // 여기서는 기본적인 라우팅만 처리
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
