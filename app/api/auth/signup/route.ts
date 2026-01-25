import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth'
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

    // 이메일 중복 체크
    const existingUser = await queryOne<User>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다' },
        { status: 400 }
      )
    }

    // 비밀번호 해시
    const passwordHash = await hashPassword(password)

    // 사용자 생성
    const [user] = await query<User>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
      [email, passwordHash]
    )

    // 토큰 생성 및 쿠키 설정
    const token = generateToken(user.id)
    await setAuthCookie(token)

    return NextResponse.json({ success: true, userId: user.id })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
