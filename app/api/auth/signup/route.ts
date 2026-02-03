import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { User } from '@/types/database'
import { signupSchema } from '@/lib/validations'
import { authRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const rl = authRateLimit(ip)
    if (!rl.success) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다' },
        { status: 400 }
      )
    }

    const { email, password, userType } = parsed.data

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

    const passwordHash = await hashPassword(password)

    const [user] = await query<User>(
      'INSERT INTO users (email, password_hash, user_type) VALUES ($1, $2, $3) RETURNING *',
      [email, passwordHash, userType]
    )

    const token = generateToken(user.id)
    await setAuthCookie(token)

    return NextResponse.json({ success: true, userId: user.id, userType })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
