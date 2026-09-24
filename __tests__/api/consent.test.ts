import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  generateToken: vi.fn(),
  setAuthCookie: vi.fn(),
}))

vi.mock('@/lib/idempotency', () => ({
  withIdempotency: vi.fn(),
}))

import { GET, POST, DELETE } from '@/app/api/consent/route'
import { GET as getEvents } from '@/app/api/consent/events/route'
import { query, queryOne, transaction } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { withIdempotency } from '@/lib/idempotency'
import type { User } from '@/types/database'

const userId = '00000000-0000-4000-8000-000000000001'
const consentId = '00000000-0000-4000-8000-000000000101'

function asUser(id = userId, userType: User['user_type'] = 'tenant'): User {
  return { id, user_type: userType } as User
}

function bodyRequest(body: Record<string, unknown>, method: string) {
  return new Request('http://localhost:3000/api/consent', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validUpsert = {
  targetRole: 'landlord',
  purpose: 'tenant_profile_view',
  allowedFields: { basic_profile: true, trust_score: true },
}

/** 멱등 래퍼는 통과시키고, 내부 handler만 검증한다. */
function passThroughIdempotency() {
  vi.mocked(withIdempotency).mockImplementation(async (options) => options.handler())
}

/** transaction(fn) 안의 client.query를 순서대로 제어한다. */
function fakeTransaction(rowsByCall: Array<{ rows: unknown[] }>) {
  vi.mocked(transaction).mockImplementation(async (fn) => {
    let call = 0
    const client = {
      query: vi.fn(async () => rowsByCall[call++] ?? { rows: [] }),
    }
    return fn(client as never)
  })
}

describe('GET /api/consent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET(new Request('http://localhost:3000/api/consent'))

    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('AUTH_REQUIRED')
  })

  it('본인 동의 목록만 조회한다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())
    vi.mocked(query).mockResolvedValueOnce([{ id: consentId, status: 'active' }])

    const res = await GET(new Request('http://localhost:3000/api/consent'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.consents).toHaveLength(1)
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain('WHERE user_id = $1')
    expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual([userId])
  })
})

describe('POST /api/consent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    passThroughIdempotency()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await POST(bodyRequest(validUpsert, 'POST'))

    expect(res.status).toBe(401)
  })

  it('허용되지 않은 purpose → 400 INVALID_PAYLOAD', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())

    const res = await POST(bodyRequest({ ...validUpsert, purpose: 'everything' }, 'POST'))

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_PAYLOAD')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('최초 동의 → 201, consent_version 1로 기록된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())
    fakeTransaction([
      { rows: [] }, // 기존 동의 없음
      { rows: [{ id: consentId, consent_version: 1, allowed_fields: {} }] }, // INSERT
      { rows: [] }, // consent_events INSERT
    ])

    const res = await POST(bodyRequest(validUpsert, 'POST'))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.consent.consent_version).toBe(1)
  })

  it('기존 활성 동의가 있으면 revoke 후 다음 버전으로 재발급한다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())
    const calls: unknown[][] = []
    vi.mocked(transaction).mockImplementation(async (fn) => {
      const responses = [
        { rows: [{ id: 'old', consent_version: 2, status: 'active', allowed_fields: {} }] },
        { rows: [] }, // UPDATE ... revoked
        { rows: [{ id: consentId, consent_version: 3, allowed_fields: {} }] },
        { rows: [] }, // consent_events
      ]
      let i = 0
      const client = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          calls.push([sql, params])
          return responses[i++] ?? { rows: [] }
        }),
      }
      return fn(client as never)
    })

    const res = await POST(bodyRequest(validUpsert, 'POST'))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.consent.consent_version).toBe(3)
    expect(String(calls[1][0])).toContain("SET status = 'revoked'")
    expect(String(calls[1][0])).toContain('revoke_reason')
    // 새 버전은 nextVersion = latest + 1 으로 들어가야 한다.
    expect((calls[2][1] as unknown[])[4]).toBe(3)
    // 이벤트 타입은 최초 부여가 아니라 갱신으로 남는다.
    expect((calls[3][1] as unknown[])[4]).toBe('updated')
  })

  it('허용 필드 누락분은 비공개 기본값으로 정규화되어 저장된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())
    const calls: unknown[][] = []
    vi.mocked(transaction).mockImplementation(async (fn) => {
      const responses = [
        { rows: [] },
        { rows: [{ id: consentId, consent_version: 1, allowed_fields: {} }] },
        { rows: [] },
      ]
      let i = 0
      const client = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          calls.push([sql, params])
          return responses[i++] ?? { rows: [] }
        }),
      }
      return fn(client as never)
    })

    await POST(
      bodyRequest({ ...validUpsert, allowedFields: { references: true } }, 'POST')
    )

    const insertedFields = (calls[1][1] as unknown[])[3] as Record<string, boolean>
    expect(insertedFields).toEqual({
      basic_profile: false,
      verification: false,
      bio: false,
      references: true,
      trust_score: false,
      contact: false,
    })
  })
})

describe('DELETE /api/consent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    passThroughIdempotency()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await DELETE(bodyRequest(validUpsert, 'DELETE'))

    expect(res.status).toBe(401)
  })

  it('활성 동의가 없으면 → 404 CONSENT_NOT_FOUND', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())
    vi.mocked(queryOne).mockResolvedValueOnce(null)

    const res = await DELETE(bodyRequest(validUpsert, 'DELETE'))

    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('CONSENT_NOT_FOUND')
  })

  it('철회 성공 → status revoked, 사유와 함께 이벤트가 남는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: consentId,
      status: 'active',
      allowed_fields: { basic_profile: true },
    })
    vi.mocked(query).mockResolvedValue([])

    const res = await DELETE(
      bodyRequest({ ...validUpsert, reason: '더 이상 필요 없음' }, 'DELETE')
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.consent.status).toBe('revoked')
    expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual([consentId, '더 이상 필요 없음'])
    const eventSql = vi.mocked(query).mock.calls[1]?.[0] as string
    expect(eventSql).toContain('consent_events')
    expect(eventSql).toContain("'revoked'")
  })
})

describe('GET /api/consent/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(query).mockResolvedValue([])
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await getEvents(new Request('http://localhost:3000/api/consent/events'))

    expect(res.status).toBe(401)
  })

  it('항상 본인 user_id로 스코프가 고정된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())

    const res = await getEvents(new Request('http://localhost:3000/api/consent/events'))

    expect(res.status).toBe(200)
    expect(vi.mocked(query).mock.calls[0]?.[0]).toContain('WHERE user_id = $1')
    expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual([userId])
  })

  it('허용되지 않은 eventType → 400 INVALID_FILTER', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())

    const res = await getEvents(
      new Request('http://localhost:3000/api/consent/events?eventType=deleted')
    )

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_FILTER')
    expect(query).not.toHaveBeenCalled()
  })

  it('허용되지 않은 targetRole → 400 INVALID_FILTER', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())

    const res = await getEvents(
      new Request('http://localhost:3000/api/consent/events?targetRole=superuser')
    )

    expect(res.status).toBe(400)
  })

  it('유효한 필터는 본인 스코프 뒤에 AND로 붙는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())

    const res = await getEvents(
      new Request(
        'http://localhost:3000/api/consent/events?targetRole=landlord&purpose=tenant_profile_view&eventType=revoked'
      )
    )

    expect(res.status).toBe(200)
    const sql = vi.mocked(query).mock.calls[0]?.[0] as string
    expect(sql).toContain('WHERE user_id = $1 AND target_role = $2 AND purpose = $3 AND event_type = $4')
    expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual([
      userId,
      'landlord',
      'tenant_profile_view',
      'revoked',
    ])
  })

  it('limit은 200으로 상한 처리된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser())

    const res = await getEvents(
      new Request('http://localhost:3000/api/consent/events?limit=9999')
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.pagination.limit).toBe(200)
  })
})
