import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query, queryOne } from './db'
import { User } from '@/types/database'
import { getJwtSecret, isJwtStrictMode, verifyJwtTokenSync } from './jwt'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(password, hash)
}

export function generateToken(userId: string, userType?: string): string {
  return jwt.sign(
    {
      userId,
      userType,
      tokenType: process.env.JWT_TOKEN_TYPE || 'access',
    },
    getJwtSecret(),
    {
      expiresIn: '7d',
      algorithm: 'HS256',
      jwtid: crypto.randomUUID(),
      audience: process.env.JWT_AUDIENCE || 'rentme-api',
      issuer: process.env.JWT_ISSUER || 'rentme',
    }
  )
}

export function verifyToken(
  token: string
): { userId: string; userType?: string; jti?: string; exp?: number } | null {
  try {
    const strictMode = isJwtStrictMode()
    const payload = verifyJwtTokenSync(token, {
      strict: strictMode,
      requireJti: strictMode,
    })

    if (payload) {
      return {
        userId: payload.userId,
        userType: payload.userType,
        jti: payload.jti,
        exp: payload.exp,
      }
    }
    if (strictMode) return null

    const legacyPayload = verifyJwtTokenSync(token, {
      strict: false,
      requireJti: false,
    })
    if (!legacyPayload) return null

    return {
      userId: legacyPayload.userId,
      userType: legacyPayload.userType,
      jti: legacyPayload.jti,
      exp: legacyPayload.exp,
    }
  } catch {
    return null
  }
}

// verifyToken + 무효화(로그아웃) 검사. 라우트 핸들러에서는 이쪽을 사용해야
// 로그아웃된 토큰이 거부된다 (verifyToken 단독은 서명/만료만 본다).
export async function verifyTokenAllowed(
  token: string
): Promise<{ userId: string; userType?: string; jti?: string; exp?: number } | null> {
  const payload = verifyToken(token)
  if (!payload) return null
  if (await isTokenRevoked(payload.jti)) return null
  return payload
}

export async function isTokenRevoked(jti: string | undefined): Promise<boolean> {
  // jti 없는 레거시 토큰은 개별 무효화가 불가능하므로 만료까지 유효(전환기 허용).
  if (!jti) return false
  const revoked = await queryOne<{ jti: string }>(
    'SELECT jti FROM revoked_tokens WHERE jti = $1',
    [jti]
  )
  return revoked !== null
}

export async function revokeToken(token: string): Promise<void> {
  const payload = verifyToken(token)
  if (!payload?.jti) return
  const expiresAt = payload.exp
    ? new Date(payload.exp * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await query(
    `INSERT INTO revoked_tokens (jti, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (jti) DO NOTHING`,
    [payload.jti, payload.userId, expiresAt.toISOString()]
  )
}

export async function getCurrentUser(): Promise<User | null> {
  const token = await getRequestToken()

  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  if (await isTokenRevoked(payload.jti)) return null

  const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [payload.userId])

  return user
}

export async function getRequestToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('auth_token')?.value
  const reqHeaders = await import('next/headers').then((h) => h.headers())
  const authHeader = (await reqHeaders).get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
  return bearerToken || cookieToken || null
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
}
