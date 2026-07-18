import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  queryOne: vi.fn(),
}))

import { POST } from '@/app/api/messages/socket-token/route'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { verifySocketToken } from '@/socket-auth'

const userId = '11111111-1111-4111-8111-111111111111'
const conversationId = '33333333-3333-4333-8333-333333333333'

function tokenRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/messages/socket-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/messages/socket-token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'socket-route-test-secret-that-is-long-enough'
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects cross-origin token requests in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.ipjuhae.com')

    const request = tokenRequest({ conversationId })
    request.headers.set('Origin', 'https://attacker.example')
    const response = await POST(request)

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(getCurrentUser).not.toHaveBeenCalled()
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('requires an authenticated user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const response = await POST(tokenRequest({ conversationId }))

    expect(response.status).toBe(401)
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('rejects malformed conversation IDs before querying membership', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId } as never)

    const response = await POST(tokenRequest({ conversationId: 'not-a-uuid' }))

    expect(response.status).toBe(400)
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('does not issue a token to a non-member', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId } as never)
    vi.mocked(queryOne).mockResolvedValue(null)

    const response = await POST(tokenRequest({ conversationId }))

    expect(response.status).toBe(404)
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('landlord_id = $2 OR tenant_id = $2'),
      [conversationId, userId]
    )
  })

  it('issues a no-store token scoped to a member conversation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: userId } as never)
    vi.mocked(queryOne).mockResolvedValue({ id: conversationId })

    const response = await POST(tokenRequest({ conversationId }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(data).toMatchObject({ conversationId, expiresIn: 300 })
    expect(verifySocketToken(data.token)).toMatchObject({ userId, conversationId })
  })
})
