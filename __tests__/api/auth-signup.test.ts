import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(),
  generateToken: vi.fn(),
  setAuthCookie: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  authRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
  track: vi.fn(),
}))

import { POST } from '@/app/api/auth/signup/route'
import { query, queryOne } from '@/lib/db'
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { authRateLimit } from '@/lib/rate-limit'

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authRateLimit).mockReturnValue({
      success: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    })
  })

  it('회원가입 성공 — tenant', async () => {
    vi.mocked(queryOne).mockResolvedValue(null) // no existing user
    vi.mocked(hashPassword).mockResolvedValue('hashed-pw')
    vi.mocked(query).mockResolvedValue([{ id: 'new-user-1', email: 'new@example.com', user_type: 'tenant' }])
    vi.mocked(generateToken).mockReturnValue('jwt-token')
    vi.mocked(setAuthCookie).mockResolvedValue(undefined)

    const res = await POST(makeRequest({
      email: 'new@example.com',
      password: 'password123',
      userType: 'tenant',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.userId).toBe('new-user-1')
    expect(hashPassword).toHaveBeenCalledWith('password123')
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['new@example.com', 'hashed-pw', 'tenant']
    )
  })

  it('회원가입 성공 — landlord', async () => {
    vi.mocked(queryOne).mockResolvedValue(null)
    vi.mocked(hashPassword).mockResolvedValue('hashed-pw')
    vi.mocked(query).mockResolvedValue([{ id: 'new-user-2', email: 'landlord@example.com', user_type: 'landlord' }])
    vi.mocked(generateToken).mockReturnValue('jwt-token')
    vi.mocked(setAuthCookie).mockResolvedValue(undefined)

    const res = await POST(makeRequest({
      email: 'landlord@example.com',
      password: 'password123',
      userType: 'landlord',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.userType).toBe('landlord')
  })

  it('중복 이메일 → 400', async () => {
    vi.mocked(queryOne).mockResolvedValue({ id: 'existing-user' })

    const res = await POST(makeRequest({
      email: 'existing@example.com',
      password: 'password123',
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('이미 사용 중인 이메일')
  })

  it('짧은 비밀번호 → 400', async () => {
    const res = await POST(makeRequest({
      email: 'new@example.com',
      password: 'short',
    }))

    expect(res.status).toBe(400)
  })

  it('이메일 누락 → 400', async () => {
    const res = await POST(makeRequest({ password: 'password123' }))

    expect(res.status).toBe(400)
  })

  it('Rate limit 초과 → 429', async () => {
    vi.mocked(authRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    })

    const res = await POST(makeRequest({
      email: 'new@example.com',
      password: 'password123',
    }))

    expect(res.status).toBe(429)
  })

  it('DB insert 오류 → 500', async () => {
    vi.mocked(queryOne).mockResolvedValue(null)
    vi.mocked(hashPassword).mockResolvedValue('hashed')
    vi.mocked(query).mockRejectedValue(new Error('DB insert failed'))

    const res = await POST(makeRequest({
      email: 'new@example.com',
      password: 'password123',
    }))

    expect(res.status).toBe(500)
  })
})
