import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  generateToken: vi.fn(),
  setAuthCookie: vi.fn(),
}))

import { GET } from '@/app/api/access-logs/route'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

function makeRequest(url = 'http://localhost:3000/api/access-logs') {
  return new Request(url)
}

describe('GET /api/access-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
  })

  it('로그인 사용자 기본 조회는 본인 기준으로 필터링', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'tenant-1', user_type: 'tenant' } as any)
    vi.mocked(query).mockResolvedValue([])

    const res = await GET(makeRequest('http://localhost:3000/api/access-logs'))

    expect(res.status).toBe(200)
    const calledSql = vi.mocked(query).mock.calls[0]?.[0] as string
    expect(calledSql).toContain('(viewer_user_id = $1 OR owner_user_id = $1)')
  })

  it('다른 사용자 actor 조회 시 403', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'tenant-1', user_type: 'tenant' } as any)

    const res = await GET(makeRequest('http://localhost:3000/api/access-logs?viewerUserId=other-user'))

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: '권한이 없습니다' })
  })
})
