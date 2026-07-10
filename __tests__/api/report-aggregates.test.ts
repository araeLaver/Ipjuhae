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

import { GET as getTenantTrust } from '@/app/api/reports/tenant-trust/[id]/aggregate/route'
import { GET as getLandlordTrust } from '@/app/api/reports/landlord-trust/[id]/aggregate/route'
import { GET as getPropertySafety } from '@/app/api/reports/property-safety/[id]/aggregate/route'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

const ownerUserId = '00000000-0000-4000-8000-000000000001'
const viewerUserId = '00000000-0000-4000-8000-000000000002'
const profileId = '00000000-0000-4000-8000-000000000101'
const propertyId = '00000000-0000-4000-8000-000000000201'

const profile = {
  id: profileId,
  user_id: ownerUserId,
  name: '김민수',
  age_range: '30대',
  family_type: '1인',
  pets: [],
  smoking: false,
  stay_time: null,
  duration: null,
  noise_level: null,
  bio: null,
  intro: null,
  trust_score: 0,
  reference_score: 0,
  verification_score: 0,
  profile_score: 0,
  is_complete: true,
  created_at: new Date(),
  updated_at: new Date(),
}

const verification = {
  id: 'verification-1',
  user_id: ownerUserId,
  employment_verified: true,
  employment_company: '테스트회사',
  employment_verified_at: new Date(),
  income_verified: true,
  income_range: '3000-5000',
  income_verified_at: new Date(),
  credit_verified: true,
  credit_grade: 2,
  credit_verified_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
}

function request(url: string) {
  return new Request(url, {
    headers: { 'user-agent': 'vitest' },
  })
}

function params(id = profileId) {
  return { params: Promise.resolve({ id }) }
}

function mockEmptyProfileAggregates() {
  vi.mocked(query).mockResolvedValueOnce([])
  vi.mocked(query).mockResolvedValueOnce([])
}

describe('GET /api/reports/*/[id]/aggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('purpose가 없으면 400을 반환하고 로그를 남기지 않음', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, user_type: 'landlord' } as any)

    const res = await getTenantTrust(
      request(`http://localhost:3000/api/reports/tenant-trust/${profileId}/aggregate`),
      params(),
    )

    expect(res.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('owner 본인은 consent 없이 접근 가능하고 granted 로그를 남김', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: ownerUserId, user_type: 'tenant' } as any)
    vi.mocked(queryOne)
      .mockResolvedValueOnce(profile as any)
      .mockResolvedValueOnce(verification as any)
    mockEmptyProfileAggregates()
    vi.mocked(query).mockResolvedValueOnce([{ id: 'log-1' }])

    const res = await getTenantTrust(
      request(`http://localhost:3000/api/reports/tenant-trust/${profileId}/aggregate?purpose=tenant_trust_review`),
      params(),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.accessLogId).toBe('log-1')
    expect(data.allowedFields).toContain('profile.contact')
    expect(vi.mocked(query).mock.calls.at(-1)?.[1]).toEqual(
      expect.arrayContaining([ownerUserId, ownerUserId, 'profile', profileId, 'granted']),
    )
  })

  it('admin은 consent 없이 접근 가능하고 admin_review purpose 로그를 남김', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, user_type: 'admin' } as any)
    vi.mocked(queryOne)
      .mockResolvedValueOnce(profile as any)
      .mockResolvedValueOnce(verification as any)
    mockEmptyProfileAggregates()
    vi.mocked(query).mockResolvedValueOnce([{ id: 'log-admin' }])

    const res = await getLandlordTrust(
      request(`http://localhost:3000/api/reports/landlord-trust/${profileId}/aggregate?purpose=admin_review`),
      params(),
    )

    expect(res.status).toBe(200)
    expect(vi.mocked(query).mock.calls.at(-1)?.[1]).toEqual(
      expect.arrayContaining([viewerUserId, ownerUserId, 'profile', profileId, 'admin_review', 'granted']),
    )
  })

  it('활성 consent는 purpose와 allowed_fields 교집합만 반환하고 contact를 마스킹', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, user_type: 'landlord' } as any)
    vi.mocked(queryOne)
      .mockResolvedValueOnce(profile as any)
      .mockResolvedValueOnce(verification as any)
    mockEmptyProfileAggregates()
    vi.mocked(query)
      .mockResolvedValueOnce([{
        id: 'consent-1',
        owner_user_id: ownerUserId,
        viewer_user_id: viewerUserId,
        viewer_role: null,
        resource_type: 'profile',
        resource_id: profileId,
        allowed_fields: ['profile.basic', 'profile.contact', 'trust.overall_signal'],
        allowed_purposes: ['tenant_trust_review'],
        can_view_contact: false,
      }])
      .mockResolvedValueOnce([{ id: 'log-2' }])

    const res = await getTenantTrust(
      request(
        `http://localhost:3000/api/reports/tenant-trust/${profileId}/aggregate?purpose=tenant_trust_review&fields=profile.basic,profile.contact,trust.overall_signal`,
      ),
      params(),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.allowedFields).toEqual(['profile.basic', 'trust.overall_signal'])
    expect(data.report.profile.contact).toBeUndefined()
    expect(vi.mocked(query).mock.calls.at(-1)?.[1]).toEqual(
      expect.arrayContaining([['profile.basic', 'trust.overall_signal'], 'tenant_trust_review', 'granted']),
    )
  })

  it('purpose 불일치 consent는 403과 denied 로그를 남김', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, user_type: 'landlord' } as any)
    vi.mocked(queryOne)
      .mockResolvedValueOnce(profile as any)
      .mockResolvedValueOnce(verification as any)
    mockEmptyProfileAggregates()
    vi.mocked(query)
      .mockResolvedValueOnce([{
        id: 'consent-1',
        owner_user_id: ownerUserId,
        viewer_user_id: viewerUserId,
        viewer_role: null,
        resource_type: 'profile',
        resource_id: profileId,
        allowed_fields: ['profile.basic'],
        allowed_purposes: ['contract_negotiation'],
        can_view_contact: false,
      }])
      .mockResolvedValueOnce([{ id: 'log-denied' }])

    const res = await getTenantTrust(
      request(`http://localhost:3000/api/reports/tenant-trust/${profileId}/aggregate?purpose=tenant_trust_review`),
      params(),
    )
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.reason).toBe('purpose_not_allowed')
    expect(vi.mocked(query).mock.calls.at(-1)?.[1]).toEqual(
      expect.arrayContaining([[], 'tenant_trust_review', 'denied']),
    )
  })

  it('consent 조회는 만료/철회/시작 전 동의를 제외하는 SQL을 사용', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: viewerUserId, user_type: 'landlord' } as any)
    vi.mocked(queryOne)
      .mockResolvedValueOnce(profile as any)
      .mockResolvedValueOnce(verification as any)
    mockEmptyProfileAggregates()
    vi.mocked(query)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'log-denied' }])

    await getTenantTrust(
      request(`http://localhost:3000/api/reports/tenant-trust/${profileId}/aggregate?purpose=tenant_trust_review`),
      params(),
    )

    const consentSql = vi.mocked(query).mock.calls.at(-2)?.[0] as string
    expect(consentSql).toContain('revoked_at IS NULL')
    expect(consentSql).toContain('valid_from <= NOW()')
    expect(consentSql).toContain('valid_until IS NULL OR valid_until >= NOW()')
  })

  it('만료된 주택 안전 score는 최신 확인 필요 상태로 반환', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: ownerUserId, user_type: 'landlord' } as any)
    vi.mocked(queryOne)
      .mockResolvedValueOnce({
        id: propertyId,
        landlord_id: ownerUserId,
        title: '테스트 매물',
        region: '서울',
        property_type: 'villa',
        status: 'available',
        updated_at: new Date(),
      } as any)
      .mockResolvedValueOnce({
        id: 'score-1',
        property_id: propertyId,
        safety_score: 80,
        risk_flags: [{ code: 'old' }],
        safety_snapshot: { checked: true },
        updated_at: new Date(),
        expires_at: new Date(Date.now() - 1000),
      } as any)
    vi.mocked(query).mockResolvedValueOnce([{ id: 'log-property' }])

    const res = await getPropertySafety(
      request(`http://localhost:3000/api/reports/property-safety/${propertyId}/aggregate?purpose=property_safety_review`),
      params(propertyId),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.report.statusFlags).toContain('최신 확인 필요')
    expect(data.report.property.riskFlags).toEqual([])
  })
})
