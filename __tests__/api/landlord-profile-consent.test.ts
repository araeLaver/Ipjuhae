import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * DOW-1187 — 집주인 프로필 노출에도 동의 판정을 적용한다.
 *
 * 이전 동작: `app/api/properties/[id]/route.ts`는 조회자가 세입자일 때만 visibility를
 * 계산했고, 그 외(비로그인·집주인·중개사)는 `isOwner || !visibility` 분기를 타서
 * 집주인 실명·bio·프로필 이미지가 마스킹 없이 나갔다. 신원이 덜 확인된 쪽이 더 많이
 * 보는 역전 구조였고, 매물 상세는 무인증 조회라 ID 순회로 대량 수집이 가능했다.
 *
 * `app/api/properties/route.ts`(공개 목록)는 동의 판정이 아예 없어 더 넓게 샜다.
 *
 * CEO 결정(DOW-1187 1번안): 예외는 `isOwner` 하나뿐. 동의 컨텍스트가 없는 비로그인은
 * fail-closed 기본값을 그대로 타서 마스킹된다. 동의 판정 경로에 `user_type` 조건이
 * 붙어 있으면 그 자체를 결함으로 본다.
 */

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  verifyToken: vi.fn(),
  verifyTokenAllowed: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/access-audit', () => ({ recordAccessAudit: vi.fn() }))

import { GET as getPropertyDetail } from '@/app/api/properties/[id]/route'
import { GET as searchProperties } from '@/app/api/properties/route'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { recordAccessAudit } from '@/lib/access-audit'

const landlordId = '11111111-1111-4111-8111-111111111111'
const tenantId = '22222222-2222-4222-8222-222222222222'
const brokerId = '33333333-3333-4333-8333-333333333333'
const propertyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const LANDLORD_REAL_NAME = '김민수'
const LANDLORD_MASKED_NAME = '김*수'

function detailRow() {
  return {
    id: propertyId,
    landlord_id: landlordId,
    title: '마포구 합정 원룸',
    description: '조용한 주거 환경',
    address: '서울 마포구 합정동 123',
    address_detail: null,
    region: '마포구',
    deposit: '5000000',
    monthly_rent: '700000',
    maintenance_fee: '50000',
    property_type: 'oneroom',
    room_count: 1,
    bathroom_count: 1,
    floor: 3,
    total_floor: 5,
    area_sqm: '28.5',
    options: ['에어컨'],
    status: 'available',
    available_from: '2026-06-01',
    view_count: 0,
    created_at: new Date('2026-05-01T00:00:00.000Z').toISOString(),
    landlord_name: LANDLORD_REAL_NAME,
    landlord_bio: '연락 잘 받습니다',
    landlord_profile_image: 'https://example.com/landlord.png',
  }
}

function listRow() {
  return {
    ...detailRow(),
    main_image_url: null,
    is_featured: false,
    featured_until: null,
    boost_score: 0,
  }
}

function activeConsent(allowed: Record<string, boolean>) {
  return {
    id: 'consent-1',
    user_id: landlordId,
    target_role: 'tenant',
    purpose: 'landlord_profile_view',
    allowed_fields: allowed,
    consent_version: 1,
    status: 'active',
    consented_at: new Date('2026-01-01T00:00:00Z'),
    expires_at: null,
    revoked_at: null,
    revoke_reason: null,
    granted_by: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
  }
}

const params = { params: Promise.resolve({ id: propertyId }) }
const detailRequest = () => new Request('http://localhost:3000/api/properties/' + propertyId)

/**
 * 상세 라우트의 queryOne 호출 순서: (1) 매물 (2) 세입자면 찜 여부 (3) 동의 레코드.
 * query 호출 순서: (1) view_count UPDATE (2) 이미지 목록.
 */
function mockDetail(opts: { actor: unknown; consent: unknown; isTenant?: boolean }) {
  vi.mocked(getCurrentUser).mockResolvedValue(opts.actor as never)
  vi.mocked(query).mockResolvedValue([] as never)

  const one = vi.mocked(queryOne)
  one.mockReset()
  one.mockResolvedValueOnce(detailRow() as never)
  if (opts.isTenant) {
    one.mockResolvedValueOnce(null as never) // 찜 여부
  }
  one.mockResolvedValueOnce(opts.consent as never)
}

describe('GET /api/properties/[id] — 집주인 프로필 동의 판정', () => {
  beforeEach(() => vi.clearAllMocks())

  it('비로그인 방문자에게 집주인 실명·bio·프로필 이미지가 마스킹된다', async () => {
    mockDetail({ actor: null, consent: null })

    const data = await (await getPropertyDetail(detailRequest(), params)).json()

    expect(data.property.landlord.name).toBe(LANDLORD_MASKED_NAME)
    expect(data.property.landlord.bio).toBeNull()
    expect(data.property.landlord.profileImage).toBeNull()
  })

  it('비로그인 방문자에게 원본 이름이 비어 있어도 null 대신 대체 표기를 보낸다', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never)
    vi.mocked(query).mockResolvedValue([] as never)
    vi.mocked(queryOne)
      .mockResolvedValueOnce({ ...detailRow(), landlord_name: null } as never)
      .mockResolvedValueOnce(null as never)

    const data = await (await getPropertyDetail(detailRequest(), params)).json()

    expect(data.property.landlord.name).toBe('비공개')
    expect(data.property.landlord.bio).toBeNull()
  })

  it('중개사 계정에게도 마스킹된다 — 역할로 판정을 건너뛰지 않는다', async () => {
    mockDetail({ actor: { id: brokerId, user_type: 'broker' }, consent: null })

    const data = await (await getPropertyDetail(detailRequest(), params)).json()

    expect(data.property.landlord.name).toBe(LANDLORD_MASKED_NAME)
    expect(data.property.landlord.bio).toBeNull()
  })

  it('다른 집주인 계정에게도 마스킹된다', async () => {
    mockDetail({ actor: { id: '99999999-9999-4999-8999-999999999999', user_type: 'landlord' }, consent: null })

    const data = await (await getPropertyDetail(detailRequest(), params)).json()

    expect(data.property.landlord.name).toBe(LANDLORD_MASKED_NAME)
  })

  it('세입자도 동의가 없으면 마스킹된다', async () => {
    mockDetail({ actor: { id: tenantId, user_type: 'tenant' }, consent: null, isTenant: true })

    const data = await (await getPropertyDetail(detailRequest(), params)).json()

    expect(data.property.landlord.name).toBe(LANDLORD_MASKED_NAME)
  })

  it('활성 동의가 basic_profile을 허용하면 실명이 보인다', async () => {
    mockDetail({
      actor: { id: tenantId, user_type: 'tenant' },
      consent: activeConsent({ basic_profile: true }),
      isTenant: true,
    })

    const data = await (await getPropertyDetail(detailRequest(), params)).json()

    expect(data.property.landlord.name).toBe(LANDLORD_REAL_NAME)
    expect(data.property.landlord.bio).toBeNull() // bio는 별도 동의 항목
  })

  it('철회된 동의 레코드는 allowed_fields가 열려 있어도 마스킹한다', async () => {
    mockDetail({
      actor: { id: tenantId, user_type: 'tenant' },
      consent: { ...activeConsent({ basic_profile: true, bio: true }), status: 'revoked' },
      isTenant: true,
    })

    const data = await (await getPropertyDetail(detailRequest(), params)).json()

    expect(data.property.landlord.name).toBe(LANDLORD_MASKED_NAME)
    expect(data.property.landlord.bio).toBeNull()
  })

  it('집주인 본인 조회는 예외 — 마스킹하지 않는다', async () => {
    mockDetail({ actor: { id: landlordId, user_type: 'landlord' }, consent: null })

    const data = await (await getPropertyDetail(detailRequest(), params)).json()

    expect(data.property.landlord.name).toBe(LANDLORD_REAL_NAME)
    expect(data.property.landlord.bio).toBe('연락 잘 받습니다')
  })

  it('전부 마스킹된 조회는 감사 로그에 landlord_profile을 기록하지 않는다', async () => {
    mockDetail({ actor: null, consent: null })

    await getPropertyDetail(detailRequest(), params)

    expect(recordAccessAudit).toHaveBeenCalledWith(
      expect.objectContaining({ fieldsViewed: ['property'] })
    )
  })

  it('실제로 공개된 항목이 있으면 감사 로그에 landlord_profile을 기록한다', async () => {
    mockDetail({
      actor: { id: tenantId, user_type: 'tenant' },
      consent: activeConsent({ basic_profile: true }),
      isTenant: true,
    })

    await getPropertyDetail(detailRequest(), params)

    expect(recordAccessAudit).toHaveBeenCalledWith(
      expect.objectContaining({ fieldsViewed: ['property', 'landlord_profile'] })
    )
  })
})

describe('GET /api/properties — 공개 목록의 집주인 실명', () => {
  beforeEach(() => vi.clearAllMocks())

  it('동의 레코드가 없으면 목록의 집주인 실명이 마스킹된다', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([listRow()] as never) // 매물 행
      .mockResolvedValueOnce([] as never) // 동의 배치 조회 — 레코드 없음

    const data = await (await searchProperties(new Request('http://localhost:3000/api/properties'))).json()

    expect(data.properties).toHaveLength(1)
    expect(data.properties[0].landlordName).toBe(LANDLORD_MASKED_NAME)
  })

  it('목록에서도 원본 이름이 비어 있으면 null 대신 대체 표기를 보낸다', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ ...listRow(), landlord_name: '' }] as never)
      .mockResolvedValueOnce([] as never)

    const data = await (await searchProperties(new Request('http://localhost:3000/api/properties'))).json()

    expect(data.properties[0].landlordName).toBe('비공개')
  })

  it('활성 동의가 있는 집주인만 실명이 보인다', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([listRow()] as never)
      .mockResolvedValueOnce([activeConsent({ basic_profile: true })] as never)

    const data = await (await searchProperties(new Request('http://localhost:3000/api/properties'))).json()

    expect(data.properties[0].landlordName).toBe(LANDLORD_REAL_NAME)
  })

  it('동의 배치 조회는 활성 레코드만 대상으로 한다 — 행마다 조회하지 않는다', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([listRow()] as never)
      .mockResolvedValueOnce([] as never)

    await searchProperties(new Request('http://localhost:3000/api/properties'))

    // 매물 1건 + 동의 배치 1건 = 총 2회. N+1이면 행 수에 따라 늘어난다.
    expect(vi.mocked(query)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(query).mock.calls[1][0]).toContain("status = 'active'")
    expect(vi.mocked(query).mock.calls[1][0]).toContain('user_id = ANY($1)')
  })

  it('여러 집주인이 섞여 있어도 배치 조회는 한 번이다', async () => {
    const otherLandlordId = '44444444-4444-4444-8444-444444444444'
    vi.mocked(query)
      .mockResolvedValueOnce([
        listRow(),
        { ...listRow(), id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', landlord_id: otherLandlordId, landlord_name: '박철수' },
      ] as never)
      .mockResolvedValueOnce([activeConsent({ basic_profile: true })] as never)

    const data = await (await searchProperties(new Request('http://localhost:3000/api/properties'))).json()

    expect(vi.mocked(query)).toHaveBeenCalledTimes(2)
    expect(data.properties[0].landlordName).toBe(LANDLORD_REAL_NAME) // 동의 있음
    expect(data.properties[1].landlordName).toBe('박*수') // 동의 없음 → 마스킹
  })
})
