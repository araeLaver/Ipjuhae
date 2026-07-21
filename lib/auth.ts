import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { queryOne } from './db'
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
      iss: process.env.JWT_ISSUER || 'rentme',
      aud: process.env.JWT_AUDIENCE || 'rentme-api',
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

export function verifyToken(token: string): { userId: string; userType?: string } | null {
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
      }
    }
    if (strictMode) return null

    const legacyPayload = verifyJwtTokenSync(token, {
      strict: false,
      requireJti: false,
    })
    if (!legacyPayload) return null

    return { userId: legacyPayload.userId, userType: legacyPayload.userType }
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('auth_token')?.value

  const reqHeaders = await import('next/headers').then((h) => h.headers())
  const authHeader = (await reqHeaders).get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  const token = bearerToken || cookieToken

  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [payload.userId])

  return user
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
