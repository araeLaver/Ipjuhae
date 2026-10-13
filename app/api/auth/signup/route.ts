import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { User } from '@/types/database'
import { signupSchema } from '@/lib/validations'
import { authRateLimit, getClientIp } from '@/lib/rate-limit'
import { trackEvent } from '@/lib/analytics'
import { notifyWelcome } from '@/lib/notifications'

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

    const { email, password, userType, name } = parsed.data

    // 가입은 누구나 가능합니다. 베타 초대 게이트(beta_config.beta_enabled +
    // waitlist 초대 토큰)는 DOW-1223 결정에 따라 제거되었습니다.
    // 초대 토큰 게이트를 되살리지 마세요 — __tests__/api/auth-signup.test.ts가 막습니다.

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
      'INSERT INTO users (email, password_hash, user_type, name) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, passwordHash, userType, name ?? null]
    )

    const token = generateToken(user.id, userType)
    await setAuthCookie(token)

    trackEvent('user_signup', { user_id: user.id, user_type: userType, source: 'direct' })
    notifyWelcome(user.id, email.split('@')[0]).catch(() => {})

    return NextResponse.json({
      success: true,
      userId: user.id,
      token,
      userType
    })
  } catch (error) {
    logger.error('Signup error', { error })
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
