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

vi.mock('@/lib/sms', () => ({
  sendReferenceRequestSMS: vi.fn().mockResolvedValue(undefined),
}))

import { GET, POST } from '@/app/api/references/route'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { sendReferenceRequestSMS } from '@/lib/sms'
import type { User } from '@/types/database'

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/references', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/references', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
  })

  it('레퍼런스 목록 반환', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as unknown as User)
    const mockRefs = [
      { id: 'ref-1', landlord_name: '박집주', status: 'completed' },
      { id: 'ref-2', landlord_name: '이건물', status: 'pending' },
    ]
    vi.mocked(query).mockResolvedValue(mockRefs)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.references).toHaveLength(2)
  })
})

describe('POST /api/references', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await POST(makeRequest({
      landlordPhone: '01012345678',
    }))

    expect(res.status).toBe(401)
  })

  it('레퍼런스 요청 성공 — SMS 발송', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as unknown as User)
    vi.mocked(queryOne)
      .mockResolvedValueOnce(null)  // no duplicate request
      .mockResolvedValueOnce({ name: '김민수' })  // user profile for name
    const mockRef = {
      id: 'ref-1',
      user_id: 'user-1',
      landlord_phone: '01012345678',
      status: 'sent',
      verification_token: 'token-abc',
    }
    vi.mocked(query).mockResolvedValue([mockRef])

    const res = await POST(makeRequest({
      landlordName: '박집주',
      landlordPhone: '01012345678',
      landlordEmail: 'park@example.com',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.reference).toBeTruthy()
    expect(data.message).toContain('전송')
    expect(sendReferenceRequestSMS).toHaveBeenCalledWith(
      '01012345678',
      '김민수',
      expect.stringContaining('/reference/survey/')
    )
  })

  it('중복 요청 방지 — 같은 번호로 pending 요청 존재', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as unknown as User)
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'existing-ref', status: 'pending' })

    const res = await POST(makeRequest({
      landlordPhone: '01012345678',
    }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('이미')
  })

  it('전화번호 누락 → 400', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as unknown as User)

    const res = await POST(makeRequest({ landlordName: '박집주' }))

    expect(res.status).toBe(400)
  })

  it('토큰 생성 — 64자 hex', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as unknown as User)
    vi.mocked(queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: '테스트' })
    vi.mocked(query).mockResolvedValue([{ id: 'ref-1', verification_token: 'abc' }])

    await POST(makeRequest({ landlordPhone: '01012345678' }))

    // Check INSERT was called with a 64-char hex token
    const insertCall = vi.mocked(query).mock.calls[0]
    const params = insertCall[1] as string[]
    const token = params[4] // verification_token is 5th param
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[0-9a-f]+$/)
  })
})
