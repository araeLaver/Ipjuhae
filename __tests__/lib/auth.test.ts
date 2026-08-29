import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  verifyTokenAllowed,
  revokeToken,
} from '@/lib/auth'
import { generateOtpCode, hashOtpCode } from '@/lib/otp'
import { query, queryOne } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}))

describe('hashPassword', () => {
  it('비밀번호를 해시화', async () => {
    const password = 'mypassword123'
    const hash = await hashPassword(password)

    expect(hash).not.toBe(password)
    expect(hash.startsWith('$2')).toBe(true) // bcrypt 해시 형식
  })

  it('같은 비밀번호도 다른 해시 생성 (salt)', async () => {
    const password = 'mypassword123'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)

    expect(hash1).not.toBe(hash2)
  })
})

describe('verifyPassword', () => {
  it('올바른 비밀번호 검증 성공', async () => {
    const password = 'correctpassword123'
    const hash = await hashPassword(password)

    const result = await verifyPassword(password, hash)
    expect(result).toBe(true)
  })

  it('틀린 비밀번호 검증 실패', async () => {
    const password = 'correctpassword123'
    const hash = await hashPassword(password)

    const result = await verifyPassword('wrongpassword', hash)
    expect(result).toBe(false)
  })

  it('null 해시에 대해 false 반환', async () => {
    const result = await verifyPassword('anypassword', null)
    expect(result).toBe(false)
  })
})

describe('generateToken / verifyToken', () => {
  it('토큰 생성 및 검증', () => {
    const userId = 'user-123-abc'
    const token = generateToken(userId)

    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3) // JWT 형식

    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload?.userId).toBe(userId)
  })

  it('잘못된 토큰 검증 실패', () => {
    const result = verifyToken('invalid.token.here')
    expect(result).toBeNull()
  })

  it('빈 문자열 토큰 검증 실패', () => {
    const result = verifyToken('')
    expect(result).toBeNull()
  })

  it('조작된 토큰 검증 실패', () => {
    const userId = 'user-123'
    const token = generateToken(userId)

    // 토큰 조작
    const parts = token.split('.')
    parts[1] = 'tamperedPayload'
    const tamperedToken = parts.join('.')

    const result = verifyToken(tamperedToken)
    expect(result).toBeNull()
  })
})

describe('세션 무효화 (revokeToken / verifyTokenAllowed)', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset()
    vi.mocked(queryOne).mockReset()
  })

  it('무효화되지 않은 토큰은 payload 반환', async () => {
    vi.mocked(queryOne).mockResolvedValue(null)
    const token = generateToken('user-1', 'tenant')

    const payload = await verifyTokenAllowed(token)
    expect(payload?.userId).toBe('user-1')
    expect(payload?.jti).toBeTruthy()
  })

  it('무효화된 jti는 거부', async () => {
    const token = generateToken('user-1', 'tenant')
    const jti = verifyToken(token)?.jti
    vi.mocked(queryOne).mockResolvedValue({ jti } as never)

    const payload = await verifyTokenAllowed(token)
    expect(payload).toBeNull()
  })

  it('revokeToken은 jti와 만료시각을 거부 목록에 기록', async () => {
    vi.mocked(query).mockResolvedValue([] as never)
    const token = generateToken('user-1', 'tenant')
    const expected = verifyToken(token)

    await revokeToken(token)

    expect(query).toHaveBeenCalledTimes(1)
    const [sql, params] = vi.mocked(query).mock.calls[0]
    expect(sql).toContain('INSERT INTO revoked_tokens')
    expect(params?.[0]).toBe(expected?.jti)
    expect(params?.[1]).toBe('user-1')
  })

  it('검증 실패 토큰은 revokeToken이 아무것도 기록하지 않음', async () => {
    await revokeToken('invalid.token.here')
    expect(query).not.toHaveBeenCalled()
  })
})

describe('OTP 해싱', () => {
  it('generateOtpCode는 6자리 숫자', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/)
    }
  })

  it('hashOtpCode는 결정적이며 평문과 다름', () => {
    const h1 = hashOtpCode('01012345678', '123456')
    const h2 = hashOtpCode('01012345678', '123456')
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
    expect(h1).not.toContain('123456')
  })

  it('전화번호가 다르면 같은 코드도 다른 해시', () => {
    expect(hashOtpCode('01011112222', '123456')).not.toBe(
      hashOtpCode('01033334444', '123456')
    )
  })
})
