import { describe, it, expect } from 'vitest'
import { matchScore, matchListings, TenantProfile, Listing } from '@/lib/matching'

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeProfile(overrides?: Partial<TenantProfile>): TenantProfile {
  return {
    budget_min: 500_000,
    budget_max: 800_000,
    preferred_region: '서울',
    move_in_date: '2024-03-01',
    ...overrides,
  }
}

function makeListing(overrides?: Partial<Listing>): Listing {
  return {
    id: 1,
    monthly_rent: 650_000,
    address: '서울 강남구 역삼동 123',
    available_from: '2024-03-01',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// matchScore — individual test cases
// ---------------------------------------------------------------------------

describe('matchScore', () => {
  it('1. 예산 정확히 일치 → 높은 점수 (budget_score 40)', () => {
    const profile = makeProfile({ budget_min: 600_000, budget_max: 700_000 })
    const listing = makeListing({ monthly_rent: 650_000 })
    const result = matchScore(profile, listing)

    expect(result.budget_score).toBe(40)
    expect(result.score).toBeGreaterThanOrEqual(40)
  })

  it('2. 월세가 budget_max * 1.1 경계값 → 매칭 (budget_score 40)', () => {
    const profile = makeProfile({ budget_min: 500_000, budget_max: 800_000 })
    // budget_max * 1.1 = 880_000 — 경계 포함
    const listing = makeListing({ monthly_rent: 880_000 })
    const result = matchScore(profile, listing)

    expect(result.budget_score).toBe(40)
  })

  it('3. 월세가 budget_max * 1.1 초과 → budget_score 0', () => {
    const profile = makeProfile({ budget_min: 500_000, budget_max: 800_000 })
    // 800_000 * 1.1 = 880_000; 880_001 초과
    const listing = makeListing({ monthly_rent: 880_001 })
    const result = matchScore(profile, listing)

    expect(result.budget_score).toBe(0)
  })

  it('4. 지역 정확히 일치 → region_score 40', () => {
    const profile = makeProfile({ preferred_region: '서울' })
    const listing = makeListing({ address: '서울 마포구 홍대입구' })
    const result = matchScore(profile, listing)

    expect(result.region_score).toBe(40)
  })

  it('5. 지역 불일치 → region_score 0', () => {
    const profile = makeProfile({ preferred_region: '서울' })
    const listing = makeListing({ address: '경기 성남시 분당구' })
    const result = matchScore(profile, listing)

    expect(result.region_score).toBe(0)
  })

  it('6. 입주일 7일 이내 차이 → date_score 20', () => {
    const profile = makeProfile({ move_in_date: '2024-03-01' })
    const listing = makeListing({ available_from: '2024-03-08' }) // 정확히 7일
    const result = matchScore(profile, listing)

    expect(result.date_score).toBe(20)
  })

  it('7. 입주일 8일 차이 → date_score 0', () => {
    const profile = makeProfile({ move_in_date: '2024-03-01' })
    const listing = makeListing({ available_from: '2024-03-09' }) // 8일 차이
    const result = matchScore(profile, listing)

    expect(result.date_score).toBe(0)
  })

  it('8. move_in_date null → date_score 20 (full points)', () => {
    const profile = makeProfile({ move_in_date: null })
    const listing = makeListing({ available_from: '2024-06-01' })
    const result = matchScore(profile, listing)

    expect(result.date_score).toBe(20)
  })

  it('8b. available_from null → date_score 20 (full points)', () => {
    const profile = makeProfile({ move_in_date: '2024-03-01' })
    const listing = makeListing({ available_from: null })
    const result = matchScore(profile, listing)

    expect(result.date_score).toBe(20)
  })

  it('9. 모든 조건 일치 → score 100', () => {
    const profile = makeProfile({
      budget_min: 600_000,
      budget_max: 700_000,
      preferred_region: '서울',
      move_in_date: '2024-03-01',
    })
    const listing = makeListing({
      monthly_rent: 650_000,
      address: '서울 강남구 역삼동 123',
      available_from: '2024-03-01',
    })
    const result = matchScore(profile, listing)

    expect(result.budget_score).toBe(40)
    expect(result.region_score).toBe(40)
    expect(result.date_score).toBe(20)
    expect(result.score).toBe(100)
  })

  it('10. 모든 조건 불일치 → score 0', () => {
    const profile = makeProfile({
      budget_min: 300_000,
      budget_max: 400_000,
      preferred_region: '서울',
      move_in_date: '2024-03-01',
    })
    const listing = makeListing({
      monthly_rent: 900_000,          // budget_max * 1.1 = 440_000 초과
      address: '부산 해운대구 우동',   // 지역 불일치
      available_from: '2024-04-01',   // 31일 차이
    })
    const result = matchScore(profile, listing)

    expect(result.budget_score).toBe(0)
    expect(result.region_score).toBe(0)
    expect(result.date_score).toBe(0)
    expect(result.score).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// matchListings — filter & sort
// ---------------------------------------------------------------------------

describe('matchListings', () => {
  it('score < 60인 매물은 필터링된다', () => {
    const profile = makeProfile({
      budget_min: 300_000,
      budget_max: 400_000,
      preferred_region: '서울',
      move_in_date: '2024-03-01',
    })
    const listings: Listing[] = [
      // score 0 (모두 불일치)
      makeListing({
        id: 1,
        monthly_rent: 900_000,
        address: '부산 해운대구',
        available_from: '2024-06-01',
      }),
      // score 100 (모두 일치)
      makeListing({
        id: 2,
        monthly_rent: 350_000,
        address: '서울 마포구',
        available_from: '2024-03-01',
      }),
    ]

    const results = matchListings(profile, listings)
    expect(results).toHaveLength(1)
    expect(results[0].listing_id).toBe(2)
    expect(results[0].score).toBe(100)
  })

  it('결과는 score 내림차순으로 정렬된다', () => {
    const profile = makeProfile({
      budget_min: 500_000,
      budget_max: 700_000,
      preferred_region: '서울',
      move_in_date: '2024-03-01',
    })
    const listings: Listing[] = [
      // score 80: budget + region (date 불일치)
      makeListing({
        id: 1,
        monthly_rent: 600_000,
        address: '서울 강남구',
        available_from: '2024-04-01', // 31일 차이
      }),
      // score 100: 모두 일치
      makeListing({
        id: 2,
        monthly_rent: 600_000,
        address: '서울 마포구',
        available_from: '2024-03-01',
      }),
      // score 60: region만 일치 (budget 불일치, date null → 20점)
      makeListing({
        id: 3,
        monthly_rent: 900_000, // 700_000 * 1.1 = 770_000 초과
        address: '서울 중구',
        available_from: null,
      }),
    ]

    const results = matchListings(profile, listings)
    // id=2(100), id=1(80), id=3(60) 순서
    expect(results.map((r) => r.listing_id)).toEqual([2, 1, 3])
    expect(results[0].score).toBe(100)
    expect(results[1].score).toBe(80)
    expect(results[2].score).toBe(60)
  })

  it('빈 listings 배열 → 빈 결과 반환', () => {
    const profile = makeProfile()
    const results = matchListings(profile, [])
    expect(results).toHaveLength(0)
  })
})
