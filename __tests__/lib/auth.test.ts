import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
} from '@/lib/auth'

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
