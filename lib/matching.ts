export interface MatchTenantProfile {
  // Budget
  budget_min: number
  budget_max: number
  // Location
  preferred_districts: string[]
  // Timing
  move_in_date: string | null
  // Lifestyle
  has_pets?: boolean
  is_smoker?: boolean
  family_type?: 'single' | 'couple' | 'family' | 'share'
  // Employment & Credit
  employment_type?: 'employed' | 'self_employed' | 'student' | 'unemployed'
  monthly_income?: number | null
  credit_grade?: 1 | 2 | 3 | 4 | null  // 1=excellent, 4=poor
  trust_score?: number  // 0-120 from calculateTrustScore
}

export interface MatchListing {
  id: number
  monthly_rent: number
  deposit?: number
  address: string
  available_from: string | null
  // Landlord preferences
  pet_allowed?: boolean | null
  smoking_allowed?: boolean | null
  preferred_family_type?: ('single' | 'couple' | 'family' | 'share')[] | null
  min_credit_grade?: 1 | 2 | 3 | 4 | null
  preferred_employment?: ('employed' | 'self_employed' | 'student' | 'unemployed')[] | null
  [key: string]: unknown
}

export type MatchGrade = 'S' | 'A' | 'B' | 'C' | 'F'

export interface MatchBreakdown {
  budget: number     // max 30
  credit: number     // max 25
  moveIn: number     // max 20
  lifestyle: number  // max 15
  employment: number // max 10
}

export interface MatchResult {
  listing: MatchListing
  score: number       // 0-100
  grade: MatchGrade   // S/A/B/C/F
  breakdown: MatchBreakdown
  reasons: string[]   // human-readable match reasons
  dealbreakers: string[] // hard rejections
}

/**
 * Kept for backward compatibility with consumers that use ScoredListing.
 * @deprecated Use MatchResult instead.
 */
export interface ScoredListing {
  listing: MatchListing
  score: number
  breakdown: {
    budget: number
    region: number
    moveIn: number
    pet: number
  }
}

function scoreToGrade(score: number): MatchGrade {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 45) return 'C'
  return 'F'
}

/**
 * Pure function: no DB calls.
 *
 * Scoring (total 100 pts):
 *   Budget     (30 pts)
 *   Credit     (25 pts)
 *   MoveIn     (20 pts)
 *   Lifestyle  (15 pts) – pet 7 + smoking 5 + family 3
 *   Employment (10 pts)
 */
export function matchScore(profile: MatchTenantProfile, listing: MatchListing): MatchResult {
  const reasons: string[] = []
  const dealbreakers: string[] = []

  // ── Budget: 30 pts ──────────────────────────────────────────────────────────
  const lowerBound = profile.budget_min * 0.8
  const upperBound = profile.budget_max * 1.2
  const innerLower = profile.budget_min * 0.9
  const innerUpper = profile.budget_max * 1.1

  let budget = 0
  if (listing.monthly_rent >= innerLower && listing.monthly_rent <= innerUpper) {
    budget = 30
    reasons.push('예산 적합')
  } else if (listing.monthly_rent >= lowerBound && listing.monthly_rent <= upperBound) {
    budget = 15
    reasons.push('예산 초과 위험')
  }
  // else budget stays 0

  // ── Credit: 25 pts ──────────────────────────────────────────────────────────
  let credit = 0
  const hasTrustScore = typeof profile.trust_score === 'number' && profile.trust_score >= 0
  const hasCreditGrade = typeof profile.credit_grade === 'number' && profile.credit_grade !== null
  const hasMinCreditGrade =
    listing.min_credit_grade !== undefined && listing.min_credit_grade !== null

  if (!hasMinCreditGrade) {
    // No landlord credit requirement → full points
    credit = 25
    reasons.push('신용 우수')
  } else if (hasTrustScore) {
    // trust_score takes priority when available
    const ts = profile.trust_score as number
    if (ts >= 80) {
      credit = 25
      reasons.push('신용 우수')
    } else if (ts >= 50) {
      credit = 18
      reasons.push('신용 보통')
    } else if (ts >= 20) {
      credit = 10
      reasons.push('신용 보통')
    } else {
      credit = 5
      dealbreakers.push('신용등급 미달')
    }
  } else if (hasCreditGrade) {
    const cg = profile.credit_grade as number
    const minCg = listing.min_credit_grade as number
    if (cg <= minCg) {
      // Lower number = better grade
      credit = 25
      reasons.push('신용 우수')
    } else if (cg === minCg + 1) {
      credit = 12
      reasons.push('신용 보통')
    } else {
      credit = 0
      dealbreakers.push('신용등급 미달')
    }
  } else {
    // No credit info available → give partial credit
    credit = 10
  }

  // ── Move-in Date: 20 pts ─────────────────────────────────────────────────────
  let moveIn = 20 // default: full points when either date is null
  if (
    profile.move_in_date !== null &&
    profile.move_in_date !== undefined &&
    listing.available_from !== null &&
    listing.available_from !== undefined
  ) {
    const tenantDate = new Date(profile.move_in_date).getTime()
    const listingDate = new Date(listing.available_from).getTime()
    const diffDays = Math.abs(tenantDate - listingDate) / (1000 * 60 * 60 * 24)

    if (diffDays <= 7) {
      moveIn = 20
      reasons.push('입주 가능')
    } else if (diffDays <= 14) {
      moveIn = 14
      reasons.push(`입주일 차이 ${Math.round(diffDays)}일`)
    } else if (diffDays <= 30) {
      moveIn = 8
      reasons.push(`입주일 차이 ${Math.round(diffDays)}일`)
    } else {
      moveIn = 0
      reasons.push(`입주일 차이 ${Math.round(diffDays)}일`)
    }
  } else {
    reasons.push('입주 가능')
  }

  // ── Lifestyle: 15 pts (pet 7 + smoking 5 + family 3) ─────────────────────────
  let petScore = 7
  if (profile.has_pets) {
    if (listing.pet_allowed === false) {
      petScore = 0
      dealbreakers.push('반려동물 불가')
    } else if (listing.pet_allowed === true) {
      petScore = 7
      reasons.push('반려동물 허용')
    } else {
      // null/undefined – give benefit of the doubt
      petScore = 7
    }
  }
  // !has_pets → always 7pts (no issue)

  let smokingScore = 5
  if (profile.is_smoker) {
    if (listing.smoking_allowed === false) {
      smokingScore = 0
      dealbreakers.push('흡연 불가')
    } else if (listing.smoking_allowed === true) {
      smokingScore = 5
      reasons.push('흡연 허용')
    } else {
      smokingScore = 5
    }
  }
  // !is_smoker → always 5pts

  let familyScore = 3
  if (
    listing.preferred_family_type !== null &&
    listing.preferred_family_type !== undefined &&
    listing.preferred_family_type.length > 0
  ) {
    if (profile.family_type && listing.preferred_family_type.includes(profile.family_type)) {
      familyScore = 3
    } else if (!profile.family_type) {
      // No info → give benefit of the doubt
      familyScore = 3
    } else {
      familyScore = 0
    }
  }
  // No preference set → 3pts

  const lifestyle = petScore + smokingScore + familyScore

  // ── Employment: 10 pts ───────────────────────────────────────────────────────
  let employment = 5 // default when no info

  const hasPreferredEmployment =
    listing.preferred_employment !== null &&
    listing.preferred_employment !== undefined &&
    listing.preferred_employment.length > 0

  if (profile.employment_type) {
    // Check listing requirement first
    if (hasPreferredEmployment) {
      const preferred = listing.preferred_employment as string[]
      if (!preferred.includes(profile.employment_type)) {
        employment = 0
        dealbreakers.push('직업 조건 불충족')
      } else {
        // In preferred list → use base score
        switch (profile.employment_type) {
          case 'employed':
            employment = 10
            reasons.push('직업 안정')
            break
          case 'self_employed':
            employment = 8
            reasons.push('직업 안정')
            break
          case 'student':
            employment = 5
            break
          case 'unemployed':
            employment = 0
            break
        }
      }
    } else {
      // No listing requirement → use base score
      switch (profile.employment_type) {
        case 'employed':
          employment = 10
          reasons.push('직업 안정')
          break
        case 'self_employed':
          employment = 8
          reasons.push('직업 안정')
          break
        case 'student':
          employment = 5
          break
        case 'unemployed':
          employment = 0
          break
      }
    }
  } else if (hasPreferredEmployment) {
    // Listing has preference but tenant has no employment info → partial
    employment = 3
  }

  // ── Final score ──────────────────────────────────────────────────────────────
  const rawScore = budget + credit + moveIn + lifestyle + employment
  const score = Math.min(100, Math.max(0, rawScore))
  const grade = scoreToGrade(score)

  return {
    listing,
    score,
    grade,
    breakdown: { budget, credit, moveIn, lifestyle, employment },
    reasons,
    dealbreakers,
  }
}

/**
 * Match tenant profile against listings.
 * Returns top `limit` scored listings sorted by score descending.
 */
export function matchListings(
  profile: MatchTenantProfile,
  listings: MatchListing[],
  limit = 10,
): MatchResult[] {
  return listings
    .map((listing) => matchScore(profile, listing))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
