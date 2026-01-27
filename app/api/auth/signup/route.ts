import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { User } from '@/types/database'

export async function POST(request: Request) {
  try {
    const { email, password, userType } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // 유효한 user_type 확인
    const validUserType = userType === 'landlord' ? 'landlord' : 'tenant'

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

    // 사용자 생성 (user_type 포함)
    const [user] = await query<User>(
      'INSERT INTO users (email, password_hash, user_type) VALUES ($1, $2, $3) RETURNING *',
      [email, passwordHash, validUserType]
    )

    // 토큰 생성 및 쿠키 설정
    const token = generateToken(user.id)
    await setAuthCookie(token)

    return NextResponse.json({ success: true, userId: user.id, userType: validUserType })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
