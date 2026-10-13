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

vi.mock('@/lib/notifications', () => ({ notifyWelcome: vi.fn(async () => {}) }))

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

  it.each(['tenant', 'landlord', 'broker'])('가입 이름을 users에 저장한다 — %s', async (userType) => {
    vi.mocked(queryOne).mockResolvedValue(null)
    vi.mocked(hashPassword).mockResolvedValue('hashed-pw')
    vi.mocked(query).mockResolvedValue([{ id: 'new-user', user_type: userType }])
    vi.mocked(generateToken).mockReturnValue('jwt-token')
    const res = await POST(makeRequest({ email: 'new@example.com', password: 'password123', userType, name: '  QA 이름  ' }))
    expect(res.status).toBe(200)
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO users.*name/),
      ['new@example.com', 'hashed-pw', userType, 'QA 이름']
    )
  })

  it.each(['   ', '가'.repeat(51), 123])('유효하지 않은 이름은 저장 전에 거절한다', async (name) => {
    const res = await POST(makeRequest({ email: 'new@example.com', password: 'password123', name }))
    expect(res.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
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
      ['new@example.com', 'hashed-pw', 'tenant', null]
    )
  })

  it('회원가입 성공 — broker', async () => {
    vi.mocked(queryOne).mockResolvedValue(null) // no existing user
    vi.mocked(hashPassword).mockResolvedValue('hashed-pw')
    vi.mocked(query).mockResolvedValue([{ id: 'new-broker-1', email: 'new@example.com', user_type: 'broker' }])
    vi.mocked(generateToken).mockReturnValue('jwt-token')
    vi.mocked(setAuthCookie).mockResolvedValue(undefined)

    const res = await POST(makeRequest({
      email: 'new@example.com',
      password: 'password123',
      userType: 'broker',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.userId).toBe('new-broker-1')
    expect(hashPassword).toHaveBeenCalledWith('password123')
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['new@example.com', 'hashed-pw', 'broker', null]
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

  // ── 베타 초대 게이트 제거 회귀 방지 (DOW-1224) ────────────────────────────
  // beta_config.beta_enabled 분기나 waitlist 초대 토큰 조회가 다시 들어오면
  // 아래 3개 테스트가 실패합니다. 되살리지 마세요.
  describe('베타 초대 게이트 제거 (DOW-1224)', () => {
    /**
     * DB가 beta_enabled='true'를 돌려주는 상황을 재현합니다.
     * 게이트가 남아 있으면 초대 토큰 없는 가입이 403으로 막힙니다.
     */
    function mockDbWithBetaEnabled() {
      vi.mocked(queryOne).mockImplementation(async (sql: string) => {
        if (/beta_config/i.test(sql)) return { value: 'true' } as never
        if (/waitlist/i.test(sql)) return null as never
        return null as never // users 조회 → 기존 사용자 없음
      })
      vi.mocked(hashPassword).mockResolvedValue('hashed-pw')
      vi.mocked(query).mockResolvedValue([
        { id: 'new-user-3', email: 'nobeta@example.com', user_type: 'tenant' },
      ])
      vi.mocked(generateToken).mockReturnValue('jwt-token')
      vi.mocked(setAuthCookie).mockResolvedValue(undefined)
    }

    function allSql(): string[] {
      return [
        ...vi.mocked(queryOne).mock.calls.map((c) => String(c[0])),
        ...vi.mocked(query).mock.calls.map((c) => String(c[0])),
      ]
    }

    it('beta_enabled=true여도 초대 토큰 없이 가입 성공', async () => {
      mockDbWithBetaEnabled()

      const res = await POST(makeRequest({
        email: 'nobeta@example.com',
        password: 'password123',
        userType: 'tenant',
      }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('가입 경로가 beta_config·waitlist를 전혀 조회하지 않음', async () => {
      mockDbWithBetaEnabled()

      await POST(makeRequest({
        email: 'nobeta@example.com',
        password: 'password123',
        userType: 'tenant',
      }))

      expect(allSql().filter((sql) => /beta_config/i.test(sql))).toEqual([])
      expect(allSql().filter((sql) => /waitlist/i.test(sql))).toEqual([])
    })

    it('inviteToken을 보내도 waitlist에 쓰지 않고 가입 성공', async () => {
      mockDbWithBetaEnabled()

      const res = await POST(makeRequest({
        email: 'nobeta@example.com',
        password: 'password123',
        userType: 'tenant',
        inviteToken: 'some-legacy-token',
      }))

      expect(res.status).toBe(200)
      expect(allSql().filter((sql) => /waitlist/i.test(sql))).toEqual([])
    })
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
