export interface MatchTenantProfile {
  budget_min: number
  budget_max: number
  preferred_districts: string[]
  move_in_date: string | null // ISO date
}

export interface MatchListing {
  id: number
  monthly_rent: number
  address: string
  available_from: string | null // ISO date
  [key: string]: unknown
}

export interface ScoredListing {
  listing: MatchListing
  score: number // 0-100
  breakdown: {
    budget: number  // max 40
    region: number  // max 30
    moveIn: number  // max 30
  }
}

/**
 * Pure function: no DB calls.
 *
 * Scoring:
 *   Budget (40 pts): monthly_rent within [budget_min * 0.9, budget_max * 1.1]
 *   Region (30 pts): listing.address includes any preferred_district
 *   Date   (30 pts): |available_from - move_in_date| <= 7 days
 *                    Full points when either date is null.
 */
export function matchScore(profile: MatchTenantProfile, listing: MatchListing): ScoredListing {
  // --- Budget score (40 pts) ---
  const lowerBound = profile.budget_min * 0.9
  const upperBound = profile.budget_max * 1.1
  const budget =
    listing.monthly_rent >= lowerBound && listing.monthly_rent <= upperBound ? 40 : 0

  // --- Region score (30 pts) ---
  let region = 0
  if (profile.preferred_districts.length > 0) {
    for (const district of profile.preferred_districts) {
      if (listing.address.includes(district)) {
        region = 30
        break
      }
    }
  }

  // --- Date score (30 pts) ---
  let moveIn = 30 // default: full points when either date is null
  if (profile.move_in_date !== null && listing.available_from !== null) {
    const tenantDate = new Date(profile.move_in_date).getTime()
    const listingDate = new Date(listing.available_from).getTime()
    const diffDays = Math.abs(tenantDate - listingDate) / (1000 * 60 * 60 * 24)
    moveIn = diffDays <= 7 ? 30 : 0
  }

  return {
    listing,
    score: budget + region + moveIn,
    breakdown: { budget, region, moveIn },
  }
}

/**
 * Match tenant profile against listings.
 * Returns all scored listings sorted by score descending.
 */
export function matchListings(profile: MatchTenantProfile, listings: MatchListing[]): ScoredListing[] {
  return listings
    .map((listing) => matchScore(profile, listing))
    .sort((a, b) => b.score - a.score)
}
