const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const SOCKET_TOKEN_AUDIENCE = 'rentme-socket'
const SOCKET_TOKEN_ISSUER = 'rentme'
const SOCKET_TOKEN_TYPE = 'conversation'
const SOCKET_TOKEN_TTL_SECONDS = 5 * 60
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  return secret
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function createSocketToken({ userId, conversationId }) {
  if (!isUuid(userId) || !isUuid(conversationId)) {
    throw new TypeError('Socket token subjects must be valid UUIDs')
  }

  return jwt.sign(
    {
      tokenType: SOCKET_TOKEN_TYPE,
      conversationId,
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      audience: SOCKET_TOKEN_AUDIENCE,
      issuer: SOCKET_TOKEN_ISSUER,
      subject: userId,
      expiresIn: SOCKET_TOKEN_TTL_SECONDS,
      jwtid: crypto.randomUUID(),
    }
  )
}

function verifySocketToken(token) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096) return null

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      audience: SOCKET_TOKEN_AUDIENCE,
      issuer: SOCKET_TOKEN_ISSUER,
      maxAge: SOCKET_TOKEN_TTL_SECONDS,
    })

    if (
      typeof payload === 'string' ||
      payload.tokenType !== SOCKET_TOKEN_TYPE ||
      !isUuid(payload.sub) ||
      !isUuid(payload.conversationId) ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > SOCKET_TOKEN_TTL_SECONDS
    ) {
      return null
    }

    return {
      userId: payload.sub,
      conversationId: payload.conversationId,
      expiresAt: payload.exp * 1000,
    }
  } catch {
    return null
  }
}

module.exports = {
  SOCKET_TOKEN_AUDIENCE,
  SOCKET_TOKEN_ISSUER,
  SOCKET_TOKEN_TTL_SECONDS,
  createSocketToken,
  verifySocketToken,
}
