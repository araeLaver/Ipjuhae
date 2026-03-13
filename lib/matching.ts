export interface MatchTenantProfile {
  budget_min: number
  budget_max: number
  preferred_districts: string[]
  move_in_date: string | null // ISO date
  has_pets?: boolean
}

export interface MatchListing {
  id: number
  monthly_rent: number
  address: string
  available_from: string | null // ISO date
  pet_allowed?: boolean | null
  [key: string]: unknown
}

export interface ScoredListing {
  listing: MatchListing
  score: number // 0-100
  breakdown: {
    budget: number  // max 40
    region: number  // max 30
    moveIn: number  // max 20
    pet: number     // max 10
  }
}

/**
 * Pure function: no DB calls.
 *
 * Scoring:
 *   Budget (40 pts): monthly_rent within [budget_min * 0.9, budget_max * 1.1]
 *   Region (30 pts): listing.address includes any preferred_district
 *   Date   (20 pts): |available_from - move_in_date| <= 7 days; full pts if either is null
 *   Pet    (10 pts): tenant !has_pets OR listing pet_allowed != false
 */
export function matchScore(profile: MatchTenantProfile, listing: MatchListing): ScoredListing {
  // Budget: 40pts
  const lowerBound = profile.budget_min * 0.9
  const upperBound = profile.budget_max * 1.1
  const budget =
    listing.monthly_rent >= lowerBound && listing.monthly_rent <= upperBound ? 40 : 0

  // Region: 30pts
  let region = 0
  if (profile.preferred_districts.length > 0) {
    for (const district of profile.preferred_districts) {
      if (listing.address.includes(district)) {
        region = 30
        break
      }
    }
  }

  // Move-in date: 20pts (was 30)
  let moveIn = 20 // default: full points when either date is null
  if (profile.move_in_date !== null && profile.move_in_date !== undefined && listing.available_from !== null) {
    const tenantDate = new Date(profile.move_in_date).getTime()
    const listingDate = new Date(listing.available_from).getTime()
    const diffDays = Math.abs(tenantDate - listingDate) / (1000 * 60 * 60 * 24)
    moveIn = diffDays <= 7 ? 20 : 0
  }

  // Pet: 10pts
  // tenant has no pets → always compatible
  // pet_allowed null/unknown → give benefit of doubt
  // tenant has pets AND pet_allowed === false → 0pts
  let pet = 10
  if (profile.has_pets && listing.pet_allowed === false) {
    pet = 0
  }

  return {
    listing,
    score: budget + region + moveIn + pet,
    breakdown: { budget, region, moveIn, pet },
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
): ScoredListing[] {
  return listings
    .map((listing) => matchScore(profile, listing))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
