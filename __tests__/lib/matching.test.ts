import { describe, it, expect } from 'vitest'
import { matchScore, matchListings, MatchTenantProfile, MatchListing } from '@/lib/matching'

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeProfile(overrides?: Partial<MatchTenantProfile>): MatchTenantProfile {
  return {
    budget_min: 50,
    budget_max: 80,
    preferred_districts: ['마포구'],
    move_in_date: '2026-04-01',
    ...overrides,
  }
}

function makeListing(overrides?: Partial<MatchListing>): MatchListing {
  return {
    id: 1,
    monthly_rent: 65,
    address: '서울 마포구 합정동 123',
    available_from: '2026-04-01',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// matchScore — 10 unit test cases
// ---------------------------------------------------------------------------

describe('matchScore', () => {
  it('1. 예산 범위 내 → budget 40pts', () => {
    const profile = makeProfile({ budget_min: 50, budget_max: 80 })
    const listing = makeListing({ monthly_rent: 65 })
    const result = matchScore(profile, listing)
    expect(result.breakdown.budget).toBe(40)
  })

  it('2. 월세가 budget_max * 1.1 경계값 → budget 40pts', () => {
    const profile = makeProfile({ budget_min: 50, budget_max: 80 })
    // 80 * 1.1 = 88
    const listing = makeListing({ monthly_rent: 88 })
    const result = matchScore(profile, listing)
    expect(result.breakdown.budget).toBe(40)
  })

  it('3. 월세가 budget_max * 1.1 초과 → budget 0pts', () => {
    const profile = makeProfile({ budget_min: 50, budget_max: 80 })
    const listing = makeListing({ monthly_rent: 89 })
    const result = matchScore(profile, listing)
    expect(result.breakdown.budget).toBe(0)
  })

  it('4. 선호 지역 일치 → region 30pts', () => {
    const profile = makeProfile({ preferred_districts: ['마포구'] })
    const listing = makeListing({ address: '서울 마포구 홍대입구' })
    const result = matchScore(profile, listing)
    expect(result.breakdown.region).toBe(30)
  })

  it('5. 선호 지역 불일치 → region 0pts', () => {
    const profile = makeProfile({ preferred_districts: ['강남구'] })
    const listing = makeListing({ address: '서울 마포구 합정동' })
    const result = matchScore(profile, listing)
    expect(result.breakdown.region).toBe(0)
  })

  it('6. 입주일 7일 이내 → moveIn 20pts', () => {
    const profile = makeProfile({ move_in_date: '2026-04-01' })
    const listing = makeListing({ available_from: '2026-04-08' }) // 7일
    const result = matchScore(profile, listing)
    expect(result.breakdown.moveIn).toBe(20)
  })

  it('7. 입주일 8일 이상 차이 → moveIn 0pts', () => {
    const profile = makeProfile({ move_in_date: '2026-04-01' })
    const listing = makeListing({ available_from: '2026-04-10' }) // 9일
    const result = matchScore(profile, listing)
    expect(result.breakdown.moveIn).toBe(0)
  })

  it('8. available_from null → moveIn 20pts (즉시 입주 가능)', () => {
    const profile = makeProfile({ move_in_date: '2026-04-01' })
    const listing = makeListing({ available_from: null })
    const result = matchScore(profile, listing)
    expect(result.breakdown.moveIn).toBe(20)
  })

  it('9. 모든 조건 일치(반려동물 없음, pet_allowed true) → score 100', () => {
    const profile = makeProfile({
      budget_min: 50,
      budget_max: 80,
      preferred_districts: ['마포구'],
      move_in_date: '2026-04-01',
      has_pets: false,
    })
    const listing = makeListing({
      monthly_rent: 65,
      address: '서울 마포구 합정동',
      available_from: '2026-04-01',
      pet_allowed: true,
    })
    const result = matchScore(profile, listing)
    expect(result.breakdown.budget).toBe(40)
    expect(result.breakdown.region).toBe(30)
    expect(result.breakdown.moveIn).toBe(20)
    expect(result.breakdown.pet).toBe(10)
    expect(result.score).toBe(100)
  })

  it('10. 예산/지역/입주일 불일치 + 반려동물 충돌 → score 0', () => {
    const profile = makeProfile({
      budget_min: 30,
      budget_max: 40,
      preferred_districts: ['강남구'],
      move_in_date: '2026-04-01',
      has_pets: true,
    })
    const listing = makeListing({
      monthly_rent: 90,
      address: '부산 해운대구 우동',
      available_from: '2026-06-01',
      pet_allowed: false,
    })
    const result = matchScore(profile, listing)
    expect(result.breakdown.budget).toBe(0)
    expect(result.breakdown.region).toBe(0)
    expect(result.breakdown.moveIn).toBe(0)
    expect(result.breakdown.pet).toBe(0)
    expect(result.score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// matchListings — sort
// ---------------------------------------------------------------------------

describe('matchListings', () => {
  it('결과는 score 내림차순으로 정렬된다', () => {
    const profile = makeProfile({
      budget_min: 50,
      budget_max: 70,
      preferred_districts: ['마포구'],
      move_in_date: '2026-04-01',
    })
    const listings: MatchListing[] = [
      // score 80: budget(40) + region(30) + moveIn(0) + pet(10)
      makeListing({ id: 1, monthly_rent: 60, address: '서울 마포구', available_from: '2026-05-01' }),
      // score 100: budget(40) + region(30) + moveIn(20) + pet(10)
      makeListing({ id: 2, monthly_rent: 60, address: '서울 마포구', available_from: '2026-04-01' }),
      // score 40: budget(0) + region(30) + moveIn(0) + pet(10)
      makeListing({ id: 3, monthly_rent: 200, address: '서울 마포구', available_from: '2026-06-01' }),
    ]

    const results = matchListings(profile, listings)
    expect(results.map((r) => r.listing.id)).toEqual([2, 1, 3])
    expect(results[0].score).toBe(100)
    expect(results[1].score).toBe(80)
  })

  it('빈 listings → 빈 결과', () => {
    const results = matchListings(makeProfile(), [])
    expect(results).toHaveLength(0)
  })

  it('20건 입력 → 기본 limit 10건만 반환', () => {
    const profile = makeProfile()
    const listings = Array.from({ length: 20 }, (_, i) =>
      makeListing({ id: i + 1, monthly_rent: 60 + i })
    )
    const results = matchListings(profile, listings)
    expect(results).toHaveLength(10)
  })

  it('커스텀 limit=5 → 5건 반환', () => {
    const profile = makeProfile()
    const listings = Array.from({ length: 20 }, (_, i) =>
      makeListing({ id: i + 1, monthly_rent: 60 + i })
    )
    const results = matchListings(profile, listings, 5)
    expect(results).toHaveLength(5)
  })
})
