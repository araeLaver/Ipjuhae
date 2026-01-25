import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { User } from '@/types/database'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // 사용자 조회
    const user = await queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (!user) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      )
    }

    // 비밀번호 확인
    const isValid = await verifyPassword(password, user.password_hash)

    if (!isValid) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      )
    }

    // 토큰 생성 및 쿠키 설정
    const token = generateToken(user.id)
    await setAuthCookie(token)

    return NextResponse.json({ success: true, userId: user.id })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
