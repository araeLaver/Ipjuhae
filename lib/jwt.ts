import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: string
  userType?: string
  nbf?: number
  exp?: number
  iat?: number
  iss?: string
  aud?: string | string[]
  jti?: string
  tokenType?: string
  sub?: string
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production')
    }
    return 'dev-only-secret-do-not-use-in-production'
  }
  return secret
}

const base64UrlReplace = (value: string): string => value.replace(/-/g, '+').replace(/_/g, '/')

const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'rentme-api'
const JWT_ISSUER = process.env.JWT_ISSUER || 'rentme'
const JWT_TOKEN_TYPE = process.env.JWT_TOKEN_TYPE || 'access'
const JWT_VERIFY_STRICT = process.env.JWT_VERIFY_STRICT === 'true'

export function isJwtStrictMode(): boolean {
  return JWT_VERIFY_STRICT
}

export function verifyJwtTokenSync(
  token: string,
  options?: {
    strict?: boolean
    requireJti?: boolean
  }
): JwtPayload | null {
  const strict = options?.strict ?? JWT_VERIFY_STRICT
  const requireJti = options?.requireJti ?? false
  const audience = process.env.JWT_AUDIENCE || JWT_AUDIENCE
  const issuer = process.env.JWT_ISSUER || JWT_ISSUER
  const tokenType = process.env.JWT_TOKEN_TYPE || JWT_TOKEN_TYPE

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      audience,
      issuer,
    }) as JwtPayload | string

    if (typeof payload === 'string') return null
    if (!payload.userId) return null

    if (payload.tokenType && payload.tokenType !== tokenType) return null
    if (strict && payload.tokenType !== tokenType) return null
    if (payload.aud && strict) {
      if (
        Array.isArray(payload.aud)
          ? !payload.aud.includes(audience)
          : payload.aud !== audience
      ) {
        return null
      }
    }
    if (strict && payload.iss && payload.iss !== issuer) return null
    if (requireJti && !payload.jti) return null
    return payload
  } catch {
    return null
  }
}

function decodeBase64Url(value: string): string {
  const normalized = `${base64UrlReplace(value)}${'='.repeat(
    (4 - (value.length % 4)) % 4
  ).replace(/0/g, '=')}`
  if (typeof atob === 'function') {
    return atob(normalized)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized, 'base64').toString('utf8')
  }
  throw new Error('No base64 decoder available')
}

function base64UrlToBytes(value: string): Uint8Array {
  const text = decodeBase64Url(value)
  return new Uint8Array(text.length).map((_, i) => text.charCodeAt(i))
}

export async function verifyJwtToken(
  token: string,
  options?: {
    secret?: string
    now?: number
    audience?: string
    issuer?: string
    tokenType?: string
    requireJti?: boolean
    strict?: boolean
  }
): Promise<JwtPayload | null> {
  const secret = options?.secret ?? getJwtSecret()
  const now = options?.now ?? Date.now()
  const audience = options?.audience ?? JWT_AUDIENCE
  const issuer = options?.issuer ?? JWT_ISSUER
  const tokenType = options?.tokenType ?? JWT_TOKEN_TYPE
  const strict = options?.strict ?? JWT_VERIFY_STRICT
  const requireJti = options?.requireJti ?? false

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerSegment, payloadSegment, signatureSegment] = parts
  let header: { alg?: string }
  let payload: JwtPayload

  try {
    header = JSON.parse(decodeBase64Url(headerSegment))
    payload = JSON.parse(decodeBase64Url(payloadSegment))
  } catch {
    return null
  }

  if (header.alg !== 'HS256' || !payload?.userId) return null
  if (payload.exp && payload.exp * 1000 <= now) return null
  if (payload.nbf && payload.nbf * 1000 > now) return null

  if (strict) {
    if (payload.iss !== issuer) return null
    if (!payload.aud || (Array.isArray(payload.aud) ? !payload.aud.includes(audience) : payload.aud !== audience))
      return null
    if (payload.tokenType !== tokenType) return null
    if (requireJti && !payload.jti) return null
  } else {
    if (payload.tokenType && payload.tokenType !== tokenType) return null
    if (payload.jti === '') return null
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(`${headerSegment}.${payloadSegment}`)
  const signature = base64UrlToBytes(signatureSegment)

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const valid = await crypto.subtle.verify('HMAC', key, signature, data)
  if (!valid) return null

  return payload
}
