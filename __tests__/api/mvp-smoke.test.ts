import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({
  trackServer: vi.fn(),
}))

import { cookies } from 'next/headers'
import { GET as getTenantMatches } from '@/app/api/matches/route'
import { POST as createConversation } from '@/app/api/messages/conversations/route'
import { GET as searchTenants } from '@/app/api/landlord/tenants/route'
import { POST as createListing } from '@/app/api/listings/route'
import { PUT as saveTenantProfile } from '@/app/api/tenant/profile/route'
import { getCurrentUser, verifyToken } from '@/lib/auth'
import { trackServer } from '@/lib/analytics'
import { query, queryOne } from '@/lib/db'

const landlordId = '11111111-1111-4111-8111-111111111111'
const tenantId = '22222222-2222-4222-8222-222222222222'

function jsonRequest(url: string, method: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockAuthCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'auth-token' || name === 'auth_token') {
        return { value: 'test-token' }
      }

      return undefined
    }),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

describe('MVP API smoke flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthCookie()
  })

  it('tenant builds a trust profile candidate through the tenant profile API', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: tenantId, email: 'tenant@example.com' } as never)
    vi.mocked(queryOne).mockResolvedValue(null)
    vi.mocked(query).mockResolvedValue([
      {
        id: 'tenant-profile-1',
        user_id: tenantId,
        budget_min: 60,
        budget_max: 90,
        preferred_districts: ['마포구', '서대문구'],
        move_in_date: '2026-06-01',
        has_pets: false,
        workplace: 'Paperclip',
      },
    ])

    const res = await saveTenantProfile(jsonRequest('http://localhost:3000/api/tenant/profile', 'PUT', {
      budget_min: 60,
      budget_max: 90,
      preferred_districts: ['마포구', '서대문구'],
      move_in_date: '2026-06-01',
      has_pets: false,
      workplace: 'Paperclip',
    }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.profile.user_id).toBe(tenantId)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tenant_profiles'),
      expect.arrayContaining([tenantId, 60, 90, ['마포구', '서대문구']]),
    )
    expect(trackServer).toHaveBeenCalledWith('profile_complete', expect.objectContaining({
      userId: tenantId,
    }))
  })

  it('landlord screens masked tenants with verification and reference signals', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: landlordId, email: 'landlord@example.com' } as never)
    vi.mocked(queryOne).mockResolvedValue({ id: landlordId, user_type: 'landlord' })
    vi.mocked(query)
      .mockResolvedValueOnce([{ count: '1' }])
      .mockResolvedValueOnce([
        {
          profile_id: 'profile-1',
          user_id: tenantId,
          name: '김민수',
          age_range: '30대',
          family_type: '1인',
          pets: [],
          smoking: false,
          stay_time: '저녁',
          duration: '1년',
          noise_level: '조용',
          trust_score: 88,
          bio: 'quiet tenant',
          profile_image_url: null,
          created_at: new Date('2026-05-01T00:00:00.000Z'),
          employment_verified: true,
          income_verified: true,
          credit_verified: false,
          ref_count: '2',
          verified_count: '2',
        },
      ])

    const res = await searchTenants(new Request(
      'http://localhost:3000/api/landlord/tenants?region=마포구&verified=employment&has_reference=true&limit=1',
    ))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.total_count).toBe(1)
    expect(data.tenants[0]).toMatchObject({
      user_id: tenantId,
      name: '김*수',
      trust_score: 88,
      reference_count: 2,
      verified: { employment: true, income: true, credit: false },
    })
    expect(data.next_cursor).toEqual(expect.any(String))
  })

  it('listing creation can feed tenant matches and start a conversation', async () => {
    vi.mocked(verifyToken).mockReturnValue({ userId: '42', userType: 'landlord' } as never)
    vi.mocked(query).mockResolvedValueOnce([
      {
        id: 7,
        landlord_id: 42,
        monthly_rent: 75,
        deposit: 1000,
        address: '서울 마포구 합정동',
        area_sqm: 28,
        floor: 4,
        photo_urls: [],
        available_from: '2026-06-01',
      },
    ])

    const listingRes = await createListing(jsonRequest('http://localhost:3000/api/listings', 'POST', {
      monthly_rent: 75,
      deposit: 1000,
      address: '서울 마포구 합정동',
      area_sqm: 28,
      floor: 4,
      photo_urls: [],
      available_from: '2026-06-01',
    }))
    const listingData = await listingRes.json()

    expect(listingRes.status).toBe(201)
    expect(listingData.listing.id).toBe(7)
    expect(trackServer).toHaveBeenCalledWith('listing_submitted', expect.objectContaining({
      userId: '42',
      listing_id: 7,
    }))

    vi.clearAllMocks()
    mockAuthCookie()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: tenantId, email: 'tenant@example.com' } as never)
    vi.mocked(queryOne).mockResolvedValue({
      user_id: tenantId,
      budget_min: 60,
      budget_max: 90,
      preferred_districts: ['마포구'],
      move_in_date: '2026-06-01',
      has_pets: false,
    })
    vi.mocked(query).mockResolvedValue([
      {
        id: 7,
        monthly_rent: '75',
        deposit: '1000',
        address: '서울 마포구 합정동',
        area_sqm: '28',
        floor: 4,
        available_from: '2026-06-01',
        pet_allowed: true,
      },
    ])

    const matchesRes = await getTenantMatches()
    const matchesData = await matchesRes.json()

    expect(matchesRes.status).toBe(200)
    expect(matchesData.total).toBe(1)
    expect(matchesData.matches[0].listing.id).toBe(7)
    expect(matchesData.matches[0].score).toBeGreaterThan(80)

    vi.clearAllMocks()
    mockAuthCookie()
    vi.mocked(verifyToken).mockReturnValue({ userId: landlordId, userType: 'landlord' } as never)
    vi.mocked(query)
      .mockResolvedValueOnce([{ user_type: 'landlord' }])
      .mockResolvedValueOnce([{ user_type: 'tenant' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'conversation-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const conversationRes = await createConversation(jsonRequest(
      'http://localhost:3000/api/messages/conversations',
      'POST',
      {
        targetUserId: tenantId,
        initialMessage: '안녕하세요. 합정동 매물 관련해서 연락드립니다.',
      },
    ))
    const conversationData = await conversationRes.json()

    expect(conversationRes.status).toBe(200)
    expect(conversationData).toEqual({ conversationId: 'conversation-1', isNew: true })
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      ['conversation-1', landlordId, '안녕하세요. 합정동 매물 관련해서 연락드립니다.'],
    )
  })
})
