import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...actual,
    setAuthCookie: vi.fn(),
    clearAuthCookie: vi.fn(),
    getCurrentUser: vi.fn(),
  }
})

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
  trackServer: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  notifyWelcome: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/rate-limit', () => ({
  authRateLimit: vi.fn().mockReturnValue({ success: true, remaining: 9, resetAt: Date.now() + 60_000 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { cookies } from 'next/headers'
import { POST as signup } from '@/app/api/auth/signup/route'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as logout } from '@/app/api/auth/logout/route'
import { GET as me } from '@/app/api/auth/me/route'
import { setAuthCookie, clearAuthCookie, getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { authRateLimit } from '@/lib/rate-limit'

function jsonRequest(url: string, method: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockCookieStore() {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieStore()
  })

  it('creates a new tenant and sets auth cookie', async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    vi.mocked(query).mockResolvedValueOnce([
      { id: 'user-1', email: 'new@example.com', user_type: 'tenant', password_hash: 'hashed' },
    ])

    const res = await signup(jsonRequest('http://localhost/api/auth/signup', 'POST', {
      email: 'new@example.com',
      password: 'Password1',
      userType: 'tenant',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.userId).toBe('user-1')
    expect(data.userType).toBe('tenant')
    expect(setAuthCookie).toHaveBeenCalledOnce()
  })

  it('creates a landlord user with correct user_type', async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    vi.mocked(query).mockResolvedValueOnce([
      { id: 'user-2', email: 'landlord@example.com', user_type: 'landlord', password_hash: 'hashed' },
    ])

    const res = await signup(jsonRequest('http://localhost/api/auth/signup', 'POST', {
      email: 'landlord@example.com',
      password: 'Password1',
      userType: 'landlord',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.userType).toBe('landlord')
  })

  it('returns 400 for duplicate email', async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-user' })

    const res = await signup(jsonRequest('http://localhost/api/auth/signup', 'POST', {
      email: 'existing@example.com',
      password: 'Password1',
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('이미 사용 중인')
  })

  it('returns 400 for weak password (no digit)', async () => {
    const res = await signup(jsonRequest('http://localhost/api/auth/signup', 'POST', {
      email: 'test@example.com',
      password: 'onlyletters',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email', async () => {
    const res = await signup(jsonRequest('http://localhost/api/auth/signup', 'POST', {
      email: 'not-an-email',
      password: 'Password1',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(authRateLimit).mockReturnValueOnce({ success: false, remaining: 0, resetAt: Date.now() + 30_000 })

    const res = await signup(jsonRequest('http://localhost/api/auth/signup', 'POST', {
      email: 'test@example.com',
      password: 'Password1',
    }))
    expect(res.status).toBe(429)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieStore()
  })

  it('logs in with correct credentials and calls setAuthCookie', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      password_hash: 'some-hash',
      user_type: 'tenant',
    })
    const authModule = await import('@/lib/auth')
    const verifySpy = vi.spyOn(authModule, 'verifyPassword').mockResolvedValueOnce(true)

    const res = await login(jsonRequest('http://localhost/api/auth/login', 'POST', {
      email: 'user@example.com',
      password: 'Password1',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.userId).toBe('user-1')
    expect(data.user.user_type).toBe('tenant')
    expect(setAuthCookie).toHaveBeenCalledOnce()

    verifySpy.mockRestore()
  })

  it('returns 401 for wrong password', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      password_hash: 'some-hash',
      user_type: 'tenant',
    })
    const authModule = await import('@/lib/auth')
    const verifySpy = vi.spyOn(authModule, 'verifyPassword').mockResolvedValueOnce(false)

    const res = await login(jsonRequest('http://localhost/api/auth/login', 'POST', {
      email: 'user@example.com',
      password: 'WrongPass1',
    }))
    expect(res.status).toBe(401)

    verifySpy.mockRestore()
  })

  it('returns 401 for unknown email', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(null)

    const res = await login(jsonRequest('http://localhost/api/auth/login', 'POST', {
      email: 'nobody@example.com',
      password: 'Password1',
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing password', async () => {
    const res = await login(jsonRequest('http://localhost/api/auth/login', 'POST', {
      email: 'user@example.com',
      password: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(authRateLimit).mockReturnValueOnce({ success: false, remaining: 0, resetAt: Date.now() + 30_000 })

    const res = await login(jsonRequest('http://localhost/api/auth/login', 'POST', {
      email: 'user@example.com',
      password: 'Password1',
    }))
    expect(res.status).toBe(429)
  })
})

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user data when authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      name: '홍길동',
      user_type: 'tenant',
    } as never)

    const res = await me()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user.id).toBe('user-1')
    expect(data.user.email).toBe('user@example.com')
    expect(data.user.userType).toBe('tenant')
    expect(data.user.name).toBe('홍길동')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

    const res = await me()
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.user).toBeNull()
  })
})

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieStore()
  })

  it('clears auth cookie and returns success', async () => {
    const res = await logout()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(clearAuthCookie).toHaveBeenCalledOnce()
  })
})
