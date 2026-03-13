import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { sendMagicLink } from '@/lib/email'
import { emailSchema } from '@/lib/validations'
import { User } from '@/types/database'

const requestBodySchema = z.object({
  email: emailSchema,
})

interface MagicLinkToken {
  id: number
  token: string
  email: string
  expires_at: Date
  used: boolean
}

// POST /api/auth/magic-link — 토큰 생성 + 이메일 발송
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = requestBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '유효하지 않은 이메일입니다' },
        { status: 400 }
      )
    }

    const { email } = parsed.data

    // 기존 미사용 토큰 만료 처리 (선택적 정리)
    await query(
      `UPDATE magic_link_tokens
         SET used = TRUE
       WHERE email = $1
         AND used = FALSE
         AND expires_at > NOW()`,
      [email]
    )

    // 새 토큰 생성
    const rows = await query<MagicLinkToken>(
      `INSERT INTO magic_link_tokens (email)
       VALUES ($1)
       RETURNING token`,
      [email]
    )

    const token = rows[0]?.token
    if (!token) {
      throw new Error('토큰 생성에 실패했습니다')
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `https://${request.headers.get('host')}`

    await sendMagicLink(email, token, baseUrl)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Magic link POST error:', error)
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// GET /api/auth/magic-link?token=xxx — 토큰 검증 + JWT 발급
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/auth/login?error=missing_token', request.url))
    }

    const magicToken = await queryOne<MagicLinkToken>(
      `SELECT * FROM magic_link_tokens
       WHERE token = $1`,
      [token]
    )

    if (!magicToken) {
      return NextResponse.redirect(new URL('/auth/login?error=invalid_token', request.url))
    }

    if (magicToken.used) {
      return NextResponse.redirect(new URL('/auth/login?error=token_used', request.url))
    }

    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.redirect(new URL('/auth/login?error=token_expired', request.url))
    }

    // 토큰 사용 처리
    await query(
      `UPDATE magic_link_tokens SET used = TRUE WHERE token = $1`,
      [token]
    )

    const email = magicToken.email

    // 유저 찾기 또는 생성
    let user = await queryOne<User>(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    )

    if (!user) {
      // 신규 유저 자동 가입
      const newUsers = await query<User>(
        `INSERT INTO users (email, user_type)
         VALUES ($1, 'tenant')
         RETURNING *`,
        [email]
      )
      user = newUsers[0] ?? null
    }

    if (!user) {
      return NextResponse.redirect(new URL('/auth/login?error=user_creation_failed', request.url))
    }

    const jwtToken = generateToken(user.id, user.user_type)
    await setAuthCookie(jwtToken)

    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('Magic link GET error:', error)
    return NextResponse.redirect(new URL('/auth/login?error=server_error', request.url))
  }
}
