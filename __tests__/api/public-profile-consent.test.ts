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

vi.mock('@/lib/access-audit', () => ({
  recordAccessAudit: vi.fn().mockResolvedValue(undefined),
}))

import { GET } from '@/app/api/profile/[id]/route'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { recordAccessAudit } from '@/lib/access-audit'
import type { DataConsent, Profile, User } from '@/types/database'

const ownerUserId = '00000000-0000-4000-8000-000000000001'
const landlordUserId = '00000000-0000-4000-8000-000000000002'
const otherTenantId = '00000000-0000-4000-8000-000000000003'
const profileId = '00000000-0000-4000-8000-000000000101'

const routeParams = { params: Promise.resolve({ id: profileId }) }

function request() {
  return new Request(`http://localhost:3000/api/profile/${profileId}`, {
    headers: { 'user-agent': 'vitest' },
  })
}

function asUser(id: string, userType: User['user_type']): User {
  return { id, user_type: userType } as User
}

function tenantProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: profileId,
    user_id: ownerUserId,
    name: '김민수',
    age_range: '30대',
    family_type: '1인',
    pets: ['고양이'],
    smoking: false,
    stay_time: '저녁',
    duration: '2년',
    noise_level: '낮음',
    bio: '조용히 지냅니다',
    trust_score: 0,
    is_complete: true,
    ...overrides,
  } as Profile
}

/** allowed_fields 일부만 허용하는 활성 동의 레코드. */
function consentAllowing(fields: Record<string, boolean>): DataConsent {
  return {
    id: 'consent-1',
    user_id: ownerUserId,
    target_role: 'landlord',
    purpose: 'tenant_profile_view',
    allowed_fields: fields,
    consent_version: 1,
    status: 'active',
    expires_at: null,
  } as unknown as DataConsent
}

describe('GET /api/profile/[id] — 동의 기반 필드 노출', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(query).mockResolvedValue([])
  })

  it('미로그인 → 401 (원본 레코드로 폴백하지 않는다)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    const res = await GET(request(), routeParams)

    expect(res.status).toBe(401)
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('완료되지 않았거나 없는 프로필 → 404', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne).mockResolvedValueOnce(null)

    const res = await GET(request(), routeParams)

    expect(res.status).toBe(404)
    // is_complete = true 조건이 SQL에 남아 있어야 한다.
    expect(vi.mocked(queryOne).mock.calls[0]?.[0]).toContain('is_complete = true')
  })

  it('소유자도 집주인도 아닌 세입자 → 403', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(otherTenantId, 'tenant'))
    vi.mocked(queryOne).mockResolvedValueOnce(tenantProfile())

    const res = await GET(request(), routeParams)

    expect(res.status).toBe(403)
    expect(recordAccessAudit).not.toHaveBeenCalled()
  })

  it('소유자는 동의 조회 없이 전체 필드를 본다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(ownerUserId, 'tenant'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce({ id: 'ver-1', user_id: ownerUserId })

    const res = await GET(request(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.name).toBe('김민수')
    expect(data.profile.bio).toBe('조용히 지냅니다')
    expect(data.verification).toBeTruthy()
    // 소유자 경로에서는 data_consents 조회가 일어나지 않는다.
    const consentLookups = vi
      .mocked(queryOne)
      .mock.calls.filter((call) => String(call[0]).includes('data_consents'))
    expect(consentLookups).toHaveLength(0)
  })

  it('집주인 + basic_profile 동의 → 실명과 상세 프로필이 그대로 노출된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce(consentAllowing({ basic_profile: true, bio: true, trust_score: true }))

    const res = await GET(request(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.name).toBe('김민수')
    expect(data.profile.age_range).toBe('30대')
    expect(data.profile.bio).toBe('조용히 지냅니다')
  })

  it('집주인 + basic_profile 미동의 → 이름 마스킹, 상세 필드는 비워진다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce(
        consentAllowing({ basic_profile: false, bio: false, trust_score: false })
      )

    const res = await GET(request(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.name).toBe('김*수')
    expect(data.profile.age_range).toBeNull()
    expect(data.profile.family_type).toBeNull()
    expect(data.profile.bio).toBeNull()
    expect(data.profile.pets).toEqual([])
    expect(data.profile.trust_score).toBe(0)
  })

  it('references 미동의 → 레퍼런스 응답이 응답 본문에서 제외된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce(consentAllowing({ basic_profile: true, references: false }))
    vi.mocked(query).mockResolvedValueOnce([{ id: 'resp-1', overall_rating: 5 }])

    const res = await GET(request(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.referenceResponses).toEqual([])
  })

  it('references 동의 → 레퍼런스 응답이 노출된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce(consentAllowing({ basic_profile: true, references: true }))
    vi.mocked(query).mockResolvedValueOnce([{ id: 'resp-1', overall_rating: 5 }])

    const res = await GET(request(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.referenceResponses).toHaveLength(1)
  })

  it('verification 미동의 → verifications 조회 자체를 하지 않는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce(consentAllowing({ basic_profile: true, verification: false }))

    const res = await GET(request(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.verification).toBeNull()
    const verificationLookups = vi
      .mocked(queryOne)
      .mock.calls.filter((call) => String(call[0]).includes('FROM verifications'))
    expect(verificationLookups).toHaveLength(0)
  })

  it('집주인 열람은 노출 필드 목록과 함께 접근 감사 로그로 남는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce(consentAllowing({ basic_profile: true, trust_score: true }))

    await GET(request(), routeParams)

    expect(recordAccessAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: landlordUserId,
        actorRole: 'landlord',
        targetType: 'tenant_profile',
        targetId: profileId,
        targetUserId: ownerUserId,
        purpose: 'tenant_profile_view',
        fieldsViewed: expect.arrayContaining(['basic_profile', 'trust_score']),
      })
    )
  })

  it('동의 레코드가 없는 집주인 → 실명·신뢰점수 포함 전부 마스킹된다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce(null)

    const res = await GET(request(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.name).toBe('김*수')
    expect(data.profile.age_range).toBeNull()
    expect(data.profile.bio).toBeNull()
    expect(data.profile.trust_score).toBe(0)
    expect(recordAccessAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldsViewed: [],
      })
    )
  })

  it('동의 철회 후 활성 레코드가 없으면 다시 기본 공개로 열리지 않는다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(asUser(landlordUserId, 'landlord'))
    vi.mocked(queryOne)
      .mockResolvedValueOnce(tenantProfile())
      .mockResolvedValueOnce(null)

    const res = await GET(request(), routeParams)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.name).toBe('김*수')
    expect(data.profile.family_type).toBeNull()
    expect(data.profile.pets).toEqual([])
    expect(data.profile.trust_score).toBe(0)
  })
})
