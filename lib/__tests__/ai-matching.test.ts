import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  scoreLocation,
  scoreLifestyleDetail,
  computeConfidence,
  aiEnhancedMatchScore,
  aiMatchListings,
  AiMatchTenantProfile,
  AiMatchListing,
} from '../ai-matching'

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const baseListing: AiMatchListing = {
  id: 1,
  monthly_rent: 900_000,
  deposit: 5_000_000,
  address: '서울시 마포구 합정동 123',
  district: '마포구',
  available_from: '2026-04-01',
  pet_allowed: true,
  smoking_allowed: false,
  preferred_family_type: ['single', 'couple'],
  min_credit_grade: null,
  preferred_employment: ['employed', 'self_employed'],
  preferred_noise_level: ['quiet', 'normal'],
  preferred_duration: ['mid', 'long'],
  description: '조용한 주거 환경, 장기 임차 선호합니다.',
}

const baseProfile: AiMatchTenantProfile = {
  budget_min: 800_000,
  budget_max: 1_000_000,
  preferred_districts: ['마포구'],
  move_in_date: '2026-04-01',
  has_pets: true,
  is_smoker: false,
  family_type: 'single',
  employment_type: 'employed',
  monthly_income: 3_000_000,
  trust_score: 90,
  noise_level: 'quiet',
  stay_time: 'often',
  duration_pref: 'long',
  age_range: '30s',
  bio: '직장인입니다. 조용하고 안정적인 생활을 원합니다.',
}

// ─── scoreLocation ────────────────────────────────────────────────────────────

describe('scoreLocation', () => {
  it('선호 지역이 없으면 최고점 반환', () => {
    const profile: AiMatchTenantProfile = { ...baseProfile, preferred_districts: [] }
    expect(scoreLocation(profile, baseListing)).toBe(15)
  })

  it('district 필드가 선호 지역과 일치하면 15점', () => {
    expect(scoreLocation(baseProfile, baseListing)).toBe(15)
  })

  it('주소 내 구 이름이 선호 지역과 일치하면 15점', () => {
    const listing: AiMatchListing = {
      ...baseListing,
      district: undefined,
      address: '서울시 마포구 연남동 456',
    }
    expect(scoreLocation(baseProfile, listing)).toBe(15)
  })

  it('같은 시지만 다른 구면 8점', () => {
    const profile: AiMatchTenantProfile = { ...baseProfile, preferred_districts: ['서울시'] }
    const listing: AiMatchListing = {
      ...baseListing,
      district: '강남구',
      address: '서울시 강남구 역삼동 789',
    }
    expect(scoreLocation(profile, listing)).toBe(8)
  })

  it('전혀 다른 지역은 0점', () => {
    const profile: AiMatchTenantProfile = { ...baseProfile, preferred_districts: ['강남구'] }
    const listing: AiMatchListing = {
      ...baseListing,
      district: '마포구',
      address: '서울시 마포구 합정동 123',
    }
    expect(scoreLocation(profile, listing)).toBe(0)
  })
})

// ─── scoreLifestyleDetail ─────────────────────────────────────────────────────

describe('scoreLifestyleDetail', () => {
  it('모든 라이프스타일 조건 충족 시 최고점 (10점)', () => {
    expect(scoreLifestyleDetail(baseProfile, baseListing)).toBe(10)
  })

  it('소음 조건 불일치 → 4점 감점', () => {
    const profile: AiMatchTenantProfile = { ...baseProfile, noise_level: 'noisy' }
    const result = scoreLifestyleDetail(profile, baseListing)
    expect(result).toBeLessThanOrEqual(6)
  })

  it('기간 조건 불일치 → 3점 감점', () => {
    const profile: AiMatchTenantProfile = { ...baseProfile, duration_pref: 'short' }
    const result = scoreLifestyleDetail(profile, baseListing)
    expect(result).toBeLessThanOrEqual(7)
  })

  it('집주인 선호 조건 없으면 해당 항목 만점', () => {
    const listing: AiMatchListing = {
      ...baseListing,
      preferred_noise_level: null,
      preferred_duration: null,
      preferred_age_ranges: null,
    }
    expect(scoreLifestyleDetail(baseProfile, listing)).toBe(10)
  })
})

// ─── computeConfidence ────────────────────────────────────────────────────────

describe('computeConfidence', () => {
  it('모든 필드 채워진 프로필: 신뢰도 높음 (>= 0.8)', () => {
    expect(computeConfidence(baseProfile)).toBeGreaterThanOrEqual(0.8)
  })

  it('최소 프로필 (예산만): 신뢰도 낮음 (<= 0.3)', () => {
    const minimal: AiMatchTenantProfile = {
      budget_min: 500_000,
      budget_max: 800_000,
      preferred_districts: [],
      move_in_date: null,
    }
    expect(computeConfidence(minimal)).toBeLessThanOrEqual(0.3)
  })

  it('신뢰도는 0-1 범위', () => {
    const c = computeConfidence(baseProfile)
    expect(c).toBeGreaterThanOrEqual(0)
    expect(c).toBeLessThanOrEqual(1)
  })
})

// ─── aiEnhancedMatchScore ─────────────────────────────────────────────────────

describe('aiEnhancedMatchScore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('완벽 프로필 + 완벽 매물: S등급 (>= 90)', async () => {
    const result = await aiEnhancedMatchScore(baseProfile, baseListing)
    expect(result.score).toBeGreaterThanOrEqual(85) // confidence-adjusted
    expect(['S', 'A']).toContain(result.grade)
    expect(result.dealbreakers).toHaveLength(0)
    expect(result.breakdown.location).toBeGreaterThan(0)
    expect(result.breakdown.lifestyleDetail).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('딜브레이커 발생 시 score <= 44', async () => {
    const profile: AiMatchTenantProfile = { ...baseProfile, has_pets: true }
    const listing: AiMatchListing = { ...baseListing, pet_allowed: false }
    const result = await aiEnhancedMatchScore(profile, listing)
    expect(result.score).toBeLessThanOrEqual(44)
    expect(result.grade).toBe('F')
    expect(result.dealbreakers).toContain('반려동물 불가')
  })

  it('예산 초과: score <= 29', async () => {
    const profile: AiMatchTenantProfile = {
      ...baseProfile,
      budget_min: 400_000,
      budget_max: 600_000,
    }
    const listing: AiMatchListing = {
      ...baseListing,
      monthly_rent: 1_500_000,
    }
    const result = await aiEnhancedMatchScore(profile, listing)
    expect(result.score).toBeLessThanOrEqual(29)
  })

  it('semantic=false 일 때 semanticSimilarity 는 undefined', async () => {
    const result = await aiEnhancedMatchScore(baseProfile, baseListing, { semantic: false })
    expect(result.semanticSimilarity).toBeUndefined()
  })

  it('rawScore는 score 이상', async () => {
    const result = await aiEnhancedMatchScore(baseProfile, baseListing)
    expect(result.rawScore).toBeGreaterThanOrEqual(result.score)
  })

  it('location 점수: 선호 지역 일치 시 location > 0', async () => {
    const result = await aiEnhancedMatchScore(baseProfile, baseListing)
    expect(result.breakdown.location).toBeGreaterThan(0)
  })

  it('location 점수: 지역 불일치 시 location 감소', async () => {
    const profile: AiMatchTenantProfile = { ...baseProfile, preferred_districts: ['강남구'] }
    const result = await aiEnhancedMatchScore(profile, baseListing)
    const fullMatch = await aiEnhancedMatchScore(baseProfile, baseListing)
    expect(result.breakdown.location).toBeLessThan(fullMatch.breakdown.location)
  })
})

// ─── aiMatchListings ──────────────────────────────────────────────────────────

describe('aiMatchListings', () => {
  it('결과를 점수 내림차순으로 정렬', async () => {
    const listings: AiMatchListing[] = [
      { ...baseListing, id: 1, monthly_rent: 900_000 },
      { ...baseListing, id: 2, monthly_rent: 1_500_000 }, // budget bust
      { ...baseListing, id: 3, monthly_rent: 850_000 },
    ]
    const results = await aiMatchListings(baseProfile, listings)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('limit 파라미터 준수', async () => {
    const listings: AiMatchListing[] = Array.from({ length: 20 }, (_, i) => ({
      ...baseListing,
      id: i + 1,
    }))
    const results = await aiMatchListings(baseProfile, listings, { limit: 5 })
    expect(results).toHaveLength(5)
  })

  it('빈 매물 목록: 빈 배열 반환', async () => {
    const results = await aiMatchListings(baseProfile, [])
    expect(results).toHaveLength(0)
  })
})
