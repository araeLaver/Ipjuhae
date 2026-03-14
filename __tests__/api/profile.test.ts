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

import { GET, POST } from '@/app/api/profile/route'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toContain('로그인')
  })

  it('프로필 없는 유저 → profile: null 반환', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ profile_image: null }) // user record
      .mockResolvedValueOnce(null) // profile
      .mockResolvedValueOnce(null) // verification
    vi.mocked(query).mockResolvedValue([]) // reference responses

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile).toBeNull()
    expect(data.verification).toBeNull()
  })

  it('프로필 있는 유저 → 동적 신뢰점수 포함 반환', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
    const mockProfile = {
      id: 'prof-1',
      user_id: 'user-1',
      name: '김민수',
      is_complete: true,
      trust_score: 0,
    }
    const mockVerification = {
      employment_verified: true,
      employment_company: '테스트회사',
      income_verified: true,
      income_range: '3000-5000',
      credit_verified: true,
      credit_grade: 2,
    }
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ profile_image: '/img/avatar.jpg' }) // user record
      .mockResolvedValueOnce(mockProfile)  // profile
      .mockResolvedValueOnce(mockVerification) // verification
    vi.mocked(query).mockResolvedValue([]) // reference responses

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile).toBeTruthy()
    expect(data.profile.trust_score).toBeGreaterThan(0) // dynamic calculation
    expect(data.trustScoreBreakdown).toBeTruthy()
    expect(data.profileImage).toBe('/img/avatar.jpg')
  })
})

describe('POST /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('미로그인 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await POST(makeRequest({ name: '테스트' }))

    expect(res.status).toBe(401)
  })

  it('신규 프로필 생성', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
    vi.mocked(queryOne).mockResolvedValue(null) // no existing profile
    const created = { id: 'prof-1', user_id: 'user-1', name: '김민수', is_complete: false }
    vi.mocked(query).mockResolvedValue([created])

    const res = await POST(makeRequest({
      name: '김민수',
      age_range: '30대',
      family_type: '1인',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.name).toBe('김민수')
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO profiles'),
      expect.any(Array)
    )
  })

  it('기존 프로필 업데이트', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
    vi.mocked(queryOne).mockResolvedValue({ id: 'prof-1' }) // existing profile
    const updated = { id: 'prof-1', user_id: 'user-1', name: '김민수 수정', is_complete: true }
    vi.mocked(query).mockResolvedValue([updated])

    const res = await POST(makeRequest({ name: '김민수 수정', is_complete: true }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.name).toBe('김민수 수정')
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE profiles'),
      expect.any(Array)
    )
  })

  it('XSS 방지 — HTML 태그 제거', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
    vi.mocked(queryOne).mockResolvedValue(null) // new profile
    vi.mocked(query).mockResolvedValue([{ id: 'prof-1', name: 'test' }])

    await POST(makeRequest({
      name: '<script>alert("xss")</script>김민수',
      bio: '<img onerror="alert(1)" src="">안녕하세요',
    }))

    // Check that sanitized values were passed to DB
    const insertCall = vi.mocked(query).mock.calls[0]
    const params = insertCall[1] as string[]
    // name param (index 1, after user_id)
    expect(params[1]).not.toContain('<script>')
    // bio param (index 9)
    expect(params[9]).not.toContain('<img')
  })
})
