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
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import type { User } from '@/types/database'

const actorId = '00000000-0000-4000-8000-000000000001'

function makeRequest(url = 'http://localhost:3000/api/access-logs') {
  return new Request(url)
}

function asUser(overrides: Partial<User>): User {
  return { id: actorId, user_type: 'tenant', ...overrides } as User
}

/** 첫 번째 query 호출은 COUNT 쿼리 — WHERE 절 검증에 사용한다. */
function firstSql(): string {
  return vi.mocked(query).mock.calls[0]?.[0] as string
}

function firstParams(): unknown[] {
  return (vi.mocked(query).mock.calls[0]?.[1] ?? []) as unknown[]
}

describe('GET /api/access-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(query).mockResolvedValue([])
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('AUTH_REQUIRED')
  })

  it('일반 사용자 조회는 본인이 행위자이거나 대상인 로그로만 한정된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser({}))
    vi.mocked(queryOne).mockResolvedValue(asUser({ user_type: 'tenant' }))

    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(firstSql()).toContain('(actor_user_id = $1 OR target_user_id = $1)')
    expect(firstParams()[0]).toBe(actorId)
  })

  it('다른 사용자 actorUserId 필터를 넘겨도 본인 스코프는 유지된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser({}))
    vi.mocked(queryOne).mockResolvedValue(asUser({ user_type: 'tenant' }))

    const res = await GET(makeRequest('http://localhost:3000/api/access-logs?actorUserId=other-user'))

    expect(res.status).toBe(200)
    // 본인 스코프 절이 먼저 붙고, 사용자가 준 필터는 AND로만 좁힌다 — 남의 로그로 넓어질 수 없다.
    expect(firstSql()).toContain('(actor_user_id = $1 OR target_user_id = $1)')
    expect(firstSql()).toContain('actor_user_id = $2')
    expect(firstParams()).toEqual([actorId, 'other-user'])
  })

  it('admin은 본인 스코프 절 없이 전체를 조회한다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser({ user_type: 'admin' }))
    vi.mocked(queryOne).mockResolvedValue(asUser({ user_type: 'admin' }))

    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(firstSql()).not.toContain('actor_user_id = $1 OR target_user_id = $1')
  })

  it('허용되지 않은 targetType → 400 INVALID_FILTER', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser({}))
    vi.mocked(queryOne).mockResolvedValue(asUser({ user_type: 'tenant' }))

    const res = await GET(makeRequest('http://localhost:3000/api/access-logs?targetType=everything'))

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_FILTER')
  })

  it('허용된 targetType 필터는 WHERE 절에 반영된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser({}))
    vi.mocked(queryOne).mockResolvedValue(asUser({ user_type: 'tenant' }))

    const res = await GET(makeRequest('http://localhost:3000/api/access-logs?targetType=tenant_profile'))

    expect(res.status).toBe(200)
    expect(firstSql()).toContain('target_type = $2')
    expect(firstParams()).toEqual([actorId, 'tenant_profile'])
  })

  it('limit은 200으로 상한 처리된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser({}))
    vi.mocked(queryOne).mockResolvedValue(asUser({ user_type: 'tenant' }))

    const res = await GET(makeRequest('http://localhost:3000/api/access-logs?limit=9999'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.pagination.limit).toBe(200)
    // 페이지 쿼리는 hasMore 판정을 위해 limit + 1을 요청한다.
    const pageParams = vi.mocked(query).mock.calls[1]?.[1] as unknown[]
    expect(pageParams[pageParams.length - 2]).toBe(201)
  })

  it('DB 오류 → 500 ACCESS_LOGS_FAILED', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser({}))
    vi.mocked(queryOne).mockRejectedValue(new Error('boom'))

    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
    expect((await res.json()).code).toBe('ACCESS_LOGS_FAILED')
  })
})
