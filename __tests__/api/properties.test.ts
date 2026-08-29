import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

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

vi.mock('@/lib/analytics', () => ({
  trackServer: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeUserInput: (s: string) => s,
}))

import { cookies } from 'next/headers'
import { GET as publicSearchProperties } from '@/app/api/properties/route'
import { GET as getPropertyDetail } from '@/app/api/properties/[id]/route'
import { GET as listLandlordProperties, POST as createProperty } from '@/app/api/landlord/properties/route'
import { PUT as updateProperty, DELETE as deleteProperty } from '@/app/api/landlord/properties/[id]/route'
import { verifyTokenAllowed, getCurrentUser } from '@/lib/auth'
import { query, queryOne, transaction } from '@/lib/db'

const landlordId = '11111111-1111-4111-8111-111111111111'
const propertyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const sampleProperty = {
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
  options: ['에어콘', '세탁기'],
  status: 'available',
  available_from: '2026-06-01',
  view_count: 0,
  created_at: new Date('2026-05-01T00:00:00.000Z').toISOString(),
  updated_at: new Date('2026-05-01T00:00:00.000Z').toISOString(),
  main_image_url: null,
}

function mockLandlordAuth() {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn((name: string) =>
      name === 'auth_token' ? { value: 'test-token' } : undefined
    ),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
  vi.mocked(verifyTokenAllowed).mockResolvedValue({ userId: landlordId, userType: 'landlord' } as never)
}

function jsonRequest(url: string, method: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/properties (public search)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns available properties with camelCase fields', async () => {
    vi.mocked(query).mockResolvedValue([
      { ...sampleProperty, is_featured: false, featured_until: null, boost_score: 0, landlord_name: '\ud64d\uae38\ub3d9' },
    ])

    const res = await publicSearchProperties(new Request('http://localhost:3000/api/properties'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.properties).toHaveLength(1)
    expect(data.properties[0].monthlyRent).toBe(700000)
    expect(data.properties[0].deposit).toBe(5000000)
    expect(data.properties[0].propertyType).toBe('oneroom')
    expect(data.hasMore).toBe(false)
    expect(data.nextCursor).toBeNull()
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('u.deleted_at IS NULL'),
      expect.any(Array),
    )
  })

  it('passes region, type, and price range filters to DB', async () => {
    vi.mocked(query).mockResolvedValue([])

    const res = await publicSearchProperties(
      new Request('http://localhost:3000/api/properties?region=\ub9c8\ud3ec\uad6c&type=oneroom&minRent=500000&maxRent=800000')
    )

    expect(res.status).toBe(200)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('p.region = $'),
      expect.arrayContaining(['\ub9c8\ud3ec\uad6c', 'oneroom', 500000, 800000]),
    )
  })

  it('paginates via cursor \u2014 hasMore true when DB returns limit+1', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      ...sampleProperty, id: `prop-${i}`,
      is_featured: false, featured_until: null, boost_score: 0, landlord_name: null,
    }))
    vi.mocked(query).mockResolvedValue(rows)

    const res = await publicSearchProperties(new Request('http://localhost:3000/api/properties?limit=20'))
    const data = await res.json()

    expect(data.properties).toHaveLength(20)
    expect(data.hasMore).toBe(true)
    expect(data.nextCursor).not.toBeNull()
  })

  it('ignores unknown property_type filter value', async () => {
    vi.mocked(query).mockResolvedValue([])
    await publicSearchProperties(new Request('http://localhost:3000/api/properties?type=INVALID'))
    // INVALID type must not be passed as a query parameter (but p.property_type is always in SELECT)
    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.arrayContaining(['INVALID']),
    )
  })
})

describe('GET /api/properties/[id] (public detail)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns camelCase property with images and landlord info', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never)
    vi.mocked(queryOne).mockResolvedValue({
      ...sampleProperty, address_detail: '101동 202호', landlord_name: '\ud64d\uae38\ub3d9', landlord_bio: null, landlord_profile_image: null,
    })
    vi.mocked(query).mockResolvedValue([])

    const res = await getPropertyDetail(
      new Request(`http://localhost:3000/api/properties/${propertyId}`),
      paramsFor(propertyId) as never
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.property.monthlyRent).toBe(700000)
    expect(data.property.landlord.name).toBe('\ud64d\uae38\ub3d9')
    expect(data.property).not.toHaveProperty('addressDetail')
    expect(data.isFavorited).toBe(false)
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('u.deleted_at IS NULL'),
      [propertyId],
    )
  })

  it('returns 404 for hidden or missing property', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never)
    vi.mocked(queryOne).mockResolvedValue(null)

    const res = await getPropertyDetail(
      new Request('http://localhost:3000/api/properties/missing'),
      paramsFor('missing') as never
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/landlord/properties/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); mockLandlordAuth() })

  it('physically deletes a property without a linked report', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ user_type: 'landlord' }])
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: propertyId }] })
    vi.mocked(transaction).mockImplementation(async (fn) => fn({ query: clientQuery } as never))

    const res = await deleteProperty(
      new Request(`http://localhost:3000/api/landlord/properties/${propertyId}`, { method: 'DELETE' }),
      paramsFor(propertyId) as never,
    )

    expect(res.status).toBe(200)
    expect(clientQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM properties'),
      [propertyId, landlordId],
    )
  })

  it('hides and anonymizes a property referenced by a contract report', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ user_type: 'landlord' }])
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ exists: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: propertyId }] })
    vi.mocked(transaction).mockImplementation(async (fn) => fn({ query: clientQuery } as never))

    const res = await deleteProperty(
      new Request(`http://localhost:3000/api/landlord/properties/${propertyId}`, { method: 'DELETE' }),
      paramsFor(propertyId) as never,
    )

    expect(res.status).toBe(200)
    expect(clientQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/status = 'hidden'[\s\S]*address_detail = NULL/),
      [propertyId, landlordId],
    )
  })
})

describe('GET /api/landlord/properties', () => {
  beforeEach(() => { vi.clearAllMocks(); mockLandlordAuth() })

  it('returns paginated list for landlord', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ user_type: 'landlord' }])
      .mockResolvedValueOnce([sampleProperty])
      .mockResolvedValueOnce([{ total: '1' }])

    const res = await listLandlordProperties(new Request('http://localhost:3000/api/landlord/properties'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.properties[0].deposit).toBe(5000000)
    expect(data.pagination.total).toBe(1)
  })

  it('returns 401 without auth token', async () => {
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn(() => undefined) } as unknown as Awaited<ReturnType<typeof cookies>>)
    const res = await listLandlordProperties(new Request('http://localhost:3000/api/landlord/properties'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for tenant user', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ user_type: 'tenant' }])
    const res = await listLandlordProperties(new Request('http://localhost:3000/api/landlord/properties'))
    expect(res.status).toBe(403)
  })
})
