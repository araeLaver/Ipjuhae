import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the route
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  verifyPassword: vi.fn(),
  generateToken: vi.fn(),
  setAuthCookie: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  authRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

import { POST } from '@/app/api/auth/login/route'
import { queryOne } from '@/lib/db'
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { authRateLimit } from '@/lib/rate-limit'

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authRateLimit).mockReturnValue({
      success: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
    })
  })

  it('로그인 성공 — 유효한 이메일+비밀번호', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password_hash: 'hashed',
      user_type: 'tenant',
    }
    vi.mocked(queryOne).mockResolvedValue(mockUser)
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(generateToken).mockReturnValue('jwt-token')
    vi.mocked(setAuthCookie).mockResolvedValue(undefined)

    const res = await POST(makeRequest({ email: 'test@example.com', password: 'password123' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.userId).toBe('user-1')
    expect(generateToken).toHaveBeenCalledWith('user-1', 'tenant')
    expect(setAuthCookie).toHaveBeenCalledWith('jwt-token')
  })

  it('존재하지 않는 이메일 → 401', async () => {
    vi.mocked(queryOne).mockResolvedValue(null)

    const res = await POST(makeRequest({ email: 'unknown@example.com', password: 'password123' }))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toContain('이메일 또는 비밀번호')
  })

  it('잘못된 비밀번호 → 401', async () => {
    vi.mocked(queryOne).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password_hash: 'hashed',
    })
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const res = await POST(makeRequest({ email: 'test@example.com', password: 'wrongpass123' }))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toContain('이메일 또는 비밀번호')
  })

  it('유효하지 않은 이메일 형식 → 400', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'password123' }))

    expect(res.status).toBe(400)
  })

  it('비밀번호 누락 → 400', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }))

    expect(res.status).toBe(400)
  })

  it('Rate limit 초과 → 429 + Retry-After 헤더', async () => {
    const resetAt = Date.now() + 30000
    vi.mocked(authRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt,
    })

    const res = await POST(makeRequest({ email: 'test@example.com', password: 'password123' }))
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data.error).toContain('요청이 너무 많습니다')
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('DB 오류 → 500', async () => {
    vi.mocked(queryOne).mockRejectedValue(new Error('DB connection failed'))

    const res = await POST(makeRequest({ email: 'test@example.com', password: 'password123' }))

    expect(res.status).toBe(500)
  })
})
