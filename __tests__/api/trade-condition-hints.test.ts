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

import { GET, POST } from '@/app/api/trade-condition-hints/route'
import { PATCH, DELETE } from '@/app/api/trade-condition-hints/[id]/route'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

function makeRequest(body?: Record<string, unknown>, search = '') {
  return new Request(`http://localhost:3000/api/trade-condition-hints${search}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/trade-condition-hints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: '로그인이 필요합니다' })
  })

  it('목록 조회 성공', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', user_type: 'tenant' } as any)
    vi.mocked(query).mockResolvedValue([
      {
        id: 'hint-1',
        tenant_user_id: '00000000-0000-4000-8000-000000000001',
        landlord_user_id: '00000000-0000-4000-8000-000000000002',
      },
    ])

    const res = await GET(makeRequest(undefined, '?tenantUserId=00000000-0000-4000-8000-000000000001&limit=3'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.hints).toHaveLength(1)
    expect(query).toHaveBeenCalled()
  })
})

describe('POST /api/trade-condition-hints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('작성 성공 시 201', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      user_type: 'tenant',
    } as any)
    vi.mocked(query).mockResolvedValue([
      {
        id: 'hint-1',
        tenant_user_id: '00000000-0000-4000-8000-000000000001',
        landlord_user_id: '00000000-0000-4000-8000-000000000002',
      },
    ])

    const res = await POST(
      makeRequest({
        tenantUserId: '00000000-0000-4000-8000-000000000001',
        landlordUserId: '00000000-0000-4000-8000-000000000002',
        hintLevel: 'normal',
        requiredDocuments: ['employment'],
        adjustmentOptions: {},
        safetyActions: ['deposit'],
        snapshot: {},
      }),
    )

    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.hint).toBeTruthy()
  })
})

describe('PATCH /api/trade-condition-hints/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('본인과 무관한 힌트는 403', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000099',
      user_type: 'tenant',
    } as any)
    vi.mocked(queryOne).mockResolvedValue({
      id: 'hint-1',
      tenant_user_id: '00000000-0000-4000-8000-000000000001',
      landlord_user_id: '00000000-0000-4000-8000-000000000002',
    })

    const res = await PATCH(
      makeRequest({
        requiredDocuments: ['income'],
      }),
      { params: Promise.resolve({ id: 'hint-1' }) },
    )

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: '권한이 없습니다' })
  })

  it('관리자가 수정 가능', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-uuid', user_type: 'admin' } as any)
    vi.mocked(queryOne)
      .mockResolvedValueOnce({
        id: 'hint-1',
        tenant_user_id: '00000000-0000-4000-8000-000000000001',
        landlord_user_id: '00000000-0000-4000-8000-000000000002',
      })
      .mockResolvedValueOnce({
        id: 'hint-1',
        tenant_user_id: '00000000-0000-4000-8000-000000000001',
        landlord_user_id: '00000000-0000-4000-8000-000000000002',
      })
    vi.mocked(query).mockResolvedValue([
      {
        id: 'hint-1',
        tenant_user_id: '00000000-0000-4000-8000-000000000001',
        landlord_user_id: '00000000-0000-4000-8000-000000000002',
      },
    ])

    const res = await PATCH(
      makeRequest({
        hintLevel: 'high',
      }),
      { params: Promise.resolve({ id: 'hint-1' }) },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ hint: { id: 'hint-1' } })
  })
})

describe('DELETE /api/trade-condition-hints/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await DELETE(makeRequest(), { params: Promise.resolve({ id: 'hint-1' }) })

    expect(res.status).toBe(401)
  })
})
