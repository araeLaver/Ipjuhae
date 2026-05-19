import { NextRequest } from 'next/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { GET } from '@/app/api/auth/magic-link/route'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
}))

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...actual,
    generateToken: vi.fn(),
    setAuthCookie: vi.fn(),
  }
})

function mockTokenRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/auth/magic-link?token=${token}`)
}

describe('GET /api/auth/magic-link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects tenant users to /profile', async () => {
    const magicToken = { token: 't1', email: 'tenant@example.com', used: false, expires_at: new Date(Date.now() + 10 * 60 * 1000) }
    const user = { id: 'u1', user_type: 'tenant' }

    vi.mocked(queryOne).mockResolvedValueOnce(magicToken)
    vi.mocked(queryOne).mockResolvedValueOnce(user)
    vi.mocked(query).mockResolvedValueOnce([])
    vi.mocked(generateToken).mockReturnValue('jwt-token')
    vi.mocked(setAuthCookie).mockResolvedValue(undefined)

    const res = await GET(mockTokenRequest('t1'))

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/profile')
    expect(generateToken).toHaveBeenCalledWith('u1', 'tenant')
  })

  it('redirects landlord users to /landlord', async () => {
    const magicToken = { token: 't2', email: 'landlord@example.com', used: false, expires_at: new Date(Date.now() + 10 * 60 * 1000) }
    const user = { id: 'u2', user_type: 'landlord' }

    vi.mocked(queryOne).mockResolvedValueOnce(magicToken)
    vi.mocked(queryOne).mockResolvedValueOnce(user)
    vi.mocked(query).mockResolvedValueOnce([])
    vi.mocked(generateToken).mockReturnValue('jwt-token')
    vi.mocked(setAuthCookie).mockResolvedValue(undefined)

    const res = await GET(mockTokenRequest('t2'))

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/landlord')
    expect(setAuthCookie).toHaveBeenCalledOnce()
  })
})
