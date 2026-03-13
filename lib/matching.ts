export interface TenantProfile {
  budget_min: number
  budget_max: number
  preferred_region: string
  move_in_date: string | null // ISO date
}

export interface Listing {
  id: number
  monthly_rent: number
  address: string
  available_from: string | null // ISO date
  [key: string]: unknown
}

export interface MatchResult {
  listing_id: number
  score: number // 0-100
  budget_score: number
  region_score: number
  date_score: number
}

/**
 * Pure function: no DB calls.
 *
 * Scoring:
 *   Budget (40 pts): monthly_rent within [budget_min * 0.9, budget_max * 1.1]
 *   Region (40 pts): listing.address includes profile.preferred_region
 *   Date   (20 pts): |available_from - move_in_date| <= 7 days
 *                    Full points also when either date is null.
 */
export function matchScore(profile: TenantProfile, listing: Listing): MatchResult {
  // --- Budget score (40 pts) ---
  const lowerBound = profile.budget_min * 0.9
  const upperBound = profile.budget_max * 1.1
  const budget_score =
    listing.monthly_rent >= lowerBound && listing.monthly_rent <= upperBound ? 40 : 0

  // --- Region score (40 pts) ---
  const region_score =
    profile.preferred_region.length > 0 &&
    listing.address.includes(profile.preferred_region)
      ? 40
      : 0

  // --- Date score (20 pts) ---
  let date_score = 20 // default: full points when either date is null
  if (profile.move_in_date !== null && listing.available_from !== null) {
    const tenantDate = new Date(profile.move_in_date).getTime()
    const listingDate = new Date(listing.available_from).getTime()
    const diffDays = Math.abs(tenantDate - listingDate) / (1000 * 60 * 60 * 24)
    date_score = diffDays <= 7 ? 20 : 0
  }

  const score = budget_score + region_score + date_score

  return {
    listing_id: listing.id,
    score,
    budget_score,
    region_score,
    date_score,
  }
}

/**
 * Filter listings with score >= 60, sorted descending by score.
 */
export function matchListings(profile: TenantProfile, listings: Listing[]): MatchResult[] {
  return listings
    .map((listing) => matchScore(profile, listing))
    .filter((result) => result.score >= 60)
    .sort((a, b) => b.score - a.score)
}
