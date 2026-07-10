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

import { GET, POST } from '@/app/api/references/[id]/disputes/route'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import type { User } from '@/types/database'

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/references/ref-1/disputes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/references/[id]/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET(new Request('http://localhost:3000/api/references/ref-1/disputes'), {
      params: Promise.resolve({ id: 'ref-1' }),
    })

    expect(res.status).toBe(401)
  })
})

describe('POST /api/references/[id]/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('분쟁 요청 생성 성공', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as unknown as User)
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: 'ref-1' }) // reference ownership check
      .mockResolvedValueOnce({ id: '6f5e4e2e-b9de-4db4-8c55-8e4f9f95ecaf' }) // response ownership check
      .mockResolvedValueOnce({ id: 'd7f4df95-e6ff-4f6f-8bcb-2f6e5a9cbe6c' }) // response item ownership check
    vi.mocked(query).mockResolvedValueOnce([
      { id: 'dispute-1', request_status: 'pending', request_type: 'correction' },
    ])

    const res = await POST(
      makeRequest({
        responseId: '6f5e4e2e-b9de-4db4-8c55-8e4f9f95ecaf',
        responseItemId: 'd7f4df95-e6ff-4f6f-8bcb-2f6e5a9cbe6c',
        requestType: 'correction',
        requestReason: '점수가 부정확합니다',
      }),
      {
        params: Promise.resolve({ id: 'ref-1' }),
      },
    )

    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.dispute).toMatchObject({
      id: 'dispute-1',
      request_status: 'pending',
    })
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reference_disputes'),
      expect.any(Array),
    )
  })

  it('응답 ID 불일치 → 400', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as unknown as User)
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ id: 'ref-1' }) // reference ownership check
      .mockResolvedValueOnce(null) // response ownership check

    const res = await POST(
      makeRequest({
        responseId: '6f5e4e2e-b9de-4db4-8c55-8e4f9f95ecaf',
        requestType: 'correction',
        requestReason: '점수가 부정확합니다',
      }),
      {
        params: Promise.resolve({ id: 'ref-1' }),
      },
    )

    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('레퍼런스 응답')
  })
})
