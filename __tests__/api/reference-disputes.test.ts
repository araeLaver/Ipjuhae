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

import { GET, POST, PATCH } from '@/app/api/references/[id]/disputes/route'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import type { User } from '@/types/database'

const ownerId = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const adminId = '00000000-0000-4000-8000-000000000003'
const referenceId = '00000000-0000-4000-8000-000000000101'
const responseId = '00000000-0000-4000-8000-000000000201'
const disputeId = '00000000-0000-4000-8000-000000000301'

const routeParams = { params: Promise.resolve({ id: referenceId }) }

function asUser(id: string, userType: User['user_type'] = 'tenant'): User {
  return { id, user_type: userType } as User
}

function getRequest() {
  return new Request(`http://localhost:3000/api/references/${referenceId}/disputes`)
}

function bodyRequest(body: Record<string, unknown>, method = 'POST') {
  return new Request(`http://localhost:3000/api/references/${referenceId}/disputes`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validDispute = {
  reason: '사실과 다른 평가',
  detail: '해당 기간에는 계약이 종료된 상태였습니다.',
}

describe('GET /api/references/[id]/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET(getRequest(), routeParams)

    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('AUTH_REQUIRED')
  })

  it('존재하지 않는 레퍼런스 → 404', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerId))
    vi.mocked(queryOne).mockResolvedValueOnce(null)

    const res = await GET(getRequest(), routeParams)

    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('REFERENCE_NOT_FOUND')
  })

  it('레퍼런스 소유자가 아니면 → 403', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(otherId))
    vi.mocked(queryOne).mockResolvedValueOnce({ id: referenceId, user_id: ownerId })

    const res = await GET(getRequest(), routeParams)

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('FORBIDDEN')
  })

  it('응답이 아직 없으면 빈 배열을 돌려준다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerId))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce(null)

    const res = await GET(getRequest(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.disputes).toEqual([])
    expect(query).not.toHaveBeenCalled()
  })

  it('소유자는 해당 응답의 이의제기 목록을 조회한다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerId))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce({ id: responseId, reference_id: referenceId })
    vi.mocked(query).mockResolvedValueOnce([{ id: disputeId, status: 'pending' }])

    const res = await GET(getRequest(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.disputes).toHaveLength(1)
    expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual([responseId])
  })
})

describe('POST /api/references/[id]/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await POST(bodyRequest(validDispute), routeParams)

    expect(res.status).toBe(401)
  })

  it('detail 길이 미달 → 400 INVALID_PAYLOAD', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerId))

    const res = await POST(bodyRequest({ reason: '오류', detail: '짧음' }), routeParams)

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_PAYLOAD')
  })

  it('소유자가 아니면 → 403', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(otherId))
    vi.mocked(queryOne).mockResolvedValueOnce({ id: referenceId, user_id: ownerId })

    const res = await POST(bodyRequest(validDispute), routeParams)

    expect(res.status).toBe(403)
  })

  it('완료된 응답이 없으면 → 400 REFERENCE_RESPONSE_NOT_FOUND', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerId))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce(null)

    const res = await POST(bodyRequest(validDispute), routeParams)

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('REFERENCE_RESPONSE_NOT_FOUND')
  })

  it('이미 진행 중인 이의제기가 있으면 → 409 DUPLICATE_DISPUTE', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerId))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce({ id: responseId })
      .mockResolvedValueOnce({ id: disputeId, status: 'pending' })

    const res = await POST(bodyRequest(validDispute), routeParams)

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('DUPLICATE_DISPUTE')
    expect(query).not.toHaveBeenCalled()
  })

  it('정상 생성 → 201, status는 pending으로 고정', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerId))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce({ id: responseId })
      .mockResolvedValueOnce(null)
    vi.mocked(query).mockResolvedValueOnce([{ id: disputeId, status: 'pending' }])

    const res = await POST(bodyRequest(validDispute), routeParams)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.dispute.status).toBe('pending')
    const insertSql = vi.mocked(query).mock.calls[0]?.[0] as string
    expect(insertSql).toContain("'pending'")
    expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual([
      responseId,
      validDispute.reason,
      validDispute.detail,
      ownerId,
    ])
  })
})

describe('PATCH /api/references/[id]/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await PATCH(bodyRequest({ status: 'reviewing' }, 'PATCH'), routeParams)

    expect(res.status).toBe(401)
  })

  it('admin이 아니면 → 403', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerId, 'tenant'))

    const res = await PATCH(bodyRequest({ status: 'reviewing' }, 'PATCH'), routeParams)

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('FORBIDDEN')
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('허용되지 않은 status 값 → 400 INVALID_PAYLOAD', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(adminId, 'admin'))

    const res = await PATCH(bodyRequest({ status: 'unknown' }, 'PATCH'), routeParams)

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('INVALID_PAYLOAD')
  })

  it('활성 이의제기가 없으면 → 404 REFERENCE_DISPUTE_NOT_FOUND', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(adminId, 'admin'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce({ id: responseId })
    vi.mocked(query).mockResolvedValueOnce([])

    const res = await PATCH(bodyRequest({ status: 'reviewing' }, 'PATCH'), routeParams)

    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('REFERENCE_DISPUTE_NOT_FOUND')
  })

  it('종결된 이의제기는 되살릴 수 없다 → 409 INVALID_DISPUTE_TRANSITION', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(adminId, 'admin'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce({ id: responseId })
    vi.mocked(query).mockResolvedValueOnce([{ id: disputeId, status: 'completed' }])

    const res = await PATCH(bodyRequest({ status: 'reviewing', disputeId }, 'PATCH'), routeParams)

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('INVALID_DISPUTE_TRANSITION')
  })

  it('같은 status로 재요청하면 변경 없이 200', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(adminId, 'admin'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce({ id: responseId })
    vi.mocked(query).mockResolvedValueOnce([{ id: disputeId, status: 'reviewing' }])

    const res = await PATCH(bodyRequest({ status: 'reviewing' }, 'PATCH'), routeParams)

    expect(res.status).toBe(200)
    // UPDATE는 실행되지 않아야 한다 (SELECT 1회만).
    expect(vi.mocked(query).mock.calls).toHaveLength(1)
  })

  it('pending → accepted 전이 성공, 검토자와 코멘트가 기록된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(adminId, 'admin'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: referenceId, user_id: ownerId })
      .mockResolvedValueOnce({ id: responseId })
    vi.mocked(query)
      .mockResolvedValueOnce([{ id: disputeId, status: 'pending' }])
      .mockResolvedValueOnce([{ id: disputeId, status: 'accepted' }])

    const res = await PATCH(
      bodyRequest({ status: 'accepted', reviewComment: '확인 완료' }, 'PATCH'),
      routeParams
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.dispute.status).toBe('accepted')
    expect(vi.mocked(query).mock.calls[1]?.[1]).toEqual(['accepted', '확인 완료', adminId, disputeId])
  })
})
