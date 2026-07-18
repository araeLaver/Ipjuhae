import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SOCKET_TOKEN_AUDIENCE,
  SOCKET_TOKEN_ISSUER,
  createSocketToken,
  verifySocketToken,
} from '@/socket-auth'

const userId = '11111111-1111-4111-8111-111111111111'
const conversationId = '33333333-3333-4333-8333-333333333333'
const testSecret = 'socket-test-secret-that-is-long-enough'
const previousJwtSecret = process.env.JWT_SECRET

describe('conversation-scoped socket tokens', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = testSecret
  })

  afterEach(() => {
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET
    } else {
      process.env.JWT_SECRET = previousJwtSecret
    }
  })

  it('creates a short-lived token limited to one user and conversation', () => {
    const token = createSocketToken({ userId, conversationId })

    expect(verifySocketToken(token)).toMatchObject({ userId, conversationId })
    const decoded = jwt.decode(token) as jwt.JwtPayload
    expect(decoded.aud).toBe(SOCKET_TOKEN_AUDIENCE)
    expect(decoded.iss).toBe(SOCKET_TOKEN_ISSUER)
    expect(decoded.exp! - decoded.iat!).toBe(300)
  })

  it('rejects a normal login token without the socket audience and type', () => {
    const token = jwt.sign({ userId }, testSecret, {
      algorithm: 'HS256',
      expiresIn: '7d',
    })

    expect(verifySocketToken(token)).toBeNull()
  })

  it('rejects a socket-shaped token with a lifetime over five minutes', () => {
    const token = jwt.sign(
      { tokenType: 'conversation', conversationId },
      testSecret,
      {
        algorithm: 'HS256',
        audience: SOCKET_TOKEN_AUDIENCE,
        issuer: SOCKET_TOKEN_ISSUER,
        subject: userId,
        expiresIn: 301,
      }
    )

    expect(verifySocketToken(token)).toBeNull()
  })

  it('rejects non-UUID token scope input', () => {
    expect(() => createSocketToken({ userId, conversationId: 'not-a-uuid' })).toThrow(TypeError)
  })

  it('fails closed when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET

    expect(() => createSocketToken({ userId, conversationId })).toThrow(
      'JWT_SECRET must be configured with at least 32 characters'
    )
  })

  it('rejects oversized handshake tokens before verification', () => {
    expect(verifySocketToken('x'.repeat(4097))).toBeNull()
  })
})
