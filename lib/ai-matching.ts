/**
 * AI-enhanced tenant ↔ listing matching module.
 *
 * Builds on top of the base rule-based algorithm in `lib/matching.ts` and adds:
 *   1. Location / district affinity scoring  (+15 pts)
 *   2. Lifestyle detail scoring  (noise, duration, stay-time, age)  (+10 bonus)
 *   3. Confidence weighting  (penalise sparse profiles)
 *   4. Optional OpenAI embedding semantic similarity  (additive bonus ×0.1)
 *
 * Total uncapped raw score: 100 (base) + 15 (location) + 10 (lifestyle detail) = 125
 * Final score is always clamped to 0-100 after confidence adjustment.
 *
 * All public functions are pure / async-safe. No direct DB access.
 */

import OpenAI from 'openai'
import { matchScore, MatchTenantProfile, MatchListing, MatchResult } from './matching'

// ─── Extended types ──────────────────────────────────────────────────────────

export type NoiseLevel = 'quiet' | 'normal' | 'noisy'
export type StayTime = 'rarely' | 'sometimes' | 'often' | 'always'
export type DurationPref = 'short' | 'mid' | 'long' // <6m / 6-24m / 24m+

/** Superset of MatchTenantProfile — all extra fields are optional. */
export interface AiMatchTenantProfile extends MatchTenantProfile {
  noise_level?: NoiseLevel
  stay_time?: StayTime
  duration_pref?: DurationPref
  age_range?: string // '20s' | '30s' | '40s' | '50s'
  bio?: string       // free-text profile introduction
}

/** Superset of MatchListing — all extra fields are optional. */
export interface AiMatchListing extends MatchListing {
  district?: string                                  // explicit district tag (마포구, 강남구…)
  preferred_noise_level?: NoiseLevel[] | null
  preferred_duration?: DurationPref[] | null
  preferred_age_ranges?: string[] | null             // ['20s', '30s']
  description?: string                               // property free-text description
}

export interface AiMatchBreakdown {
  // ── base scores (from matchScore) ──
  budget: number        // max 30
  credit: number        // max 25
  moveIn: number        // max 20
  lifestyle: number     // max 15  (pet + smoking + family)
  employment: number    // max 10
  // ── AI-added scores ──
  location: number      // max 15
  lifestyleDetail: number // max 10 (noise + duration + stayTime + age)
}

export interface AiMatchResult {
  listing: AiMatchListing
  score: number               // 0-100 final, confidence-adjusted
  rawScore: number            // 0-125 before adjustment
  grade: 'S' | 'A' | 'B' | 'C' | 'F'
  breakdown: AiMatchBreakdown
  confidence: number          // 0-1  (data completeness)
  semanticSimilarity?: number // 0-1  (OpenAI embedding cosine; undefined when skipped)
  reasons: string[]
  dealbreakers: string[]
}

// ─── Location scoring ─────────────────────────────────────────────────────────

/**
 * Score how well the listing location matches the tenant's preferred districts.
 *
 * Max 15 pts:
 *   15  — exact district match inside preferred list
 *    8  — same city / borough prefix (e.g. '서울' in both)
 *    0  — no overlap
 *
 * Returns 15 when preferred_districts is empty (benefit of doubt).
 */
export function scoreLocation(profile: AiMatchTenantProfile, listing: AiMatchListing): number {
  const preferred = profile.preferred_districts

  if (!preferred || preferred.length === 0) return 15

  // Normalise: strip whitespace, lowercase
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

  // Candidate strings to check against: explicit district tag + address tokens
  const candidates: string[] = []
  if (listing.district) candidates.push(norm(listing.district))
  if (listing.address) {
    // Korean addresses often contain 구/동 as distinct tokens
    const tokens = listing.address.split(/[\s,]+/).map(norm)
    candidates.push(...tokens)
    candidates.push(norm(listing.address))
  }

  // Distinguish specific (구/동 level) vs broad (시/도 level) preferences.
  // "서울시" alone → broad; "마포구" / "합정동" → specific.
  const isBroadDistrict = (d: string) => /시$|도$|특별시$|광역시$/.test(d.trim())

  for (const district of preferred) {
    const nd = norm(district)

    if (isBroadDistrict(district)) {
      // Broad preference (시/도): only award partial points (8).
      // Skip here — handled below after specific check.
      continue
    }

    // Specific preference (구/동): exact substring match → 15 pts
    if (candidates.some((c) => c.includes(nd) || nd.includes(c))) {
      return 15
    }
  }

  // City / province level match (8 pts)
  for (const district of preferred) {
    if (!isBroadDistrict(district)) continue
    const nd = norm(district)
    if (candidates.some((c) => c.includes(nd) || nd.includes(c))) {
      return 8
    }
  }

  // Fallback: same city by address prefix (first 2 chars match)
  if (listing.address) {
    const addrCity = norm(listing.address).slice(0, 2)
    if (
      preferred.some((d) => {
        const nd = norm(d)
        return nd.startsWith(addrCity) || addrCity.startsWith(nd.slice(0, 2))
      })
    ) {
      return 8
    }
  }

  return 0
}

// ─── Lifestyle detail scoring ─────────────────────────────────────────────────

/**
 * Score granular lifestyle compatibility (noise, duration, stay pattern, age).
 *
 * Max 10 pts:
 *   Noise level match  4 pts
 *   Duration match     3 pts
 *   Stay-time match    2 pts
 *   Age range match    1 pt
 *
 * Missing data → full points for that sub-dimension (benefit of doubt).
 */
export function scoreLifestyleDetail(
  profile: AiMatchTenantProfile,
  listing: AiMatchListing,
): number {
  let pts = 0

  // Noise level (4 pts)
  if (
    listing.preferred_noise_level &&
    listing.preferred_noise_level.length > 0 &&
    profile.noise_level
  ) {
    pts += listing.preferred_noise_level.includes(profile.noise_level) ? 4 : 0
  } else {
    pts += 4 // benefit of doubt
  }

  // Duration preference (3 pts)
  if (
    listing.preferred_duration &&
    listing.preferred_duration.length > 0 &&
    profile.duration_pref
  ) {
    pts += listing.preferred_duration.includes(profile.duration_pref) ? 3 : 0
  } else {
    pts += 3
  }

  // Stay-time (2 pts) — not stored on listing, but affects desirability
  // Currently not constrained by landlord; award 2 if profile has any value
  pts += profile.stay_time ? 2 : 2 // always 2 (placeholder for future landlord prefs)

  // Age range (1 pt)
  if (
    listing.preferred_age_ranges &&
    listing.preferred_age_ranges.length > 0 &&
    profile.age_range
  ) {
    pts += listing.preferred_age_ranges.includes(profile.age_range) ? 1 : 0
  } else {
    pts += 1
  }

  return pts
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

/**
 * Measure how complete / trustworthy the tenant profile is.
 *
 * Each present field contributes equally. Returns 0-1.
 * Confidence is used to down-weight scores for sparse profiles:
 *   finalScore = rawScore × (BASE_WEIGHT + (1 - BASE_WEIGHT) × confidence)
 * where BASE_WEIGHT = 0.75 means a fully empty profile still gets 75% of its score.
 */
const CONFIDENCE_FIELDS: (keyof AiMatchTenantProfile)[] = [
  'budget_min',
  'budget_max',
  'preferred_districts',
  'move_in_date',
  'has_pets',
  'is_smoker',
  'family_type',
  'employment_type',
  'trust_score',
  'credit_grade',
  'noise_level',
  'stay_time',
  'duration_pref',
  'bio',
]

export function computeConfidence(profile: AiMatchTenantProfile): number {
  let filled = 0
  for (const key of CONFIDENCE_FIELDS) {
    const v = profile[key]
    if (v !== undefined && v !== null && v !== '') {
      // preferred_districts: count as filled only if non-empty array
      if (Array.isArray(v)) {
        if (v.length > 0) filled++
      } else {
        filled++
      }
    }
  }
  return filled / CONFIDENCE_FIELDS.length
}

const BASE_WEIGHT = 0.75

function applyConfidence(rawScore: number, confidence: number): number {
  const factor = BASE_WEIGHT + (1 - BASE_WEIGHT) * confidence
  return Math.round(rawScore * factor)
}

// ─── OpenAI semantic similarity ───────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

/**
 * Compute cosine similarity between tenant bio and listing description
 * using OpenAI text-embedding-3-small embeddings.
 *
 * Returns undefined when OpenAI is unavailable or texts are missing.
 * Never throws — silently returns undefined on any error.
 */
export async function computeSemanticSimilarity(
  tenantText: string | undefined,
  listingText: string | undefined,
): Promise<number | undefined> {
  if (!tenantText || !listingText) return undefined
  const ai = getOpenAI()
  if (!ai) return undefined

  try {
    const [r1, r2] = await Promise.all([
      ai.embeddings.create({ model: 'text-embedding-3-small', input: tenantText }),
      ai.embeddings.create({ model: 'text-embedding-3-small', input: listingText }),
    ])
    const v1 = r1.data[0].embedding
    const v2 = r2.data[0].embedding
    return cosineSimilarity(v1, v2)
  } catch {
    return undefined
  }
}

// ─── Grade helper (same thresholds as base) ───────────────────────────────────

function toGrade(score: number): AiMatchResult['grade'] {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 45) return 'C'
  return 'F'
}

// ─── Main export: aiEnhancedMatchScore ───────────────────────────────────────

/**
 * AI-enhanced match: rule-based base score + location + lifestyle detail +
 * optional semantic similarity, then confidence-adjusted to 0-100.
 *
 * @param profile   AiMatchTenantProfile (superset of MatchTenantProfile)
 * @param listing   AiMatchListing (superset of MatchListing)
 * @param semantic  When true, fetches OpenAI embeddings. Default false (sync fast path).
 */
export async function aiEnhancedMatchScore(
  profile: AiMatchTenantProfile,
  listing: AiMatchListing,
  { semantic = false }: { semantic?: boolean } = {},
): Promise<AiMatchResult> {
  // 1. Base rule-based score
  const base: MatchResult = matchScore(profile as MatchTenantProfile, listing as MatchListing)

  // 2. Location score (0-15)
  const locationScore = scoreLocation(profile, listing)

  // 3. Lifestyle detail score (0-10)
  const lifestyleDetailScore = scoreLifestyleDetail(profile, listing)

  // 4. Semantic similarity (optional, 0-1 → ×10 bonus points)
  let sim: number | undefined
  if (semantic) {
    sim = await computeSemanticSimilarity(profile.bio, listing.description)
  }
  const semanticBonus = sim !== undefined ? Math.round(sim * 10) : 0

  // 5. Raw combined score
  const rawScore = base.score + locationScore + lifestyleDetailScore + semanticBonus

  // 6. Confidence weighting
  const confidence = computeConfidence(profile)
  const adjustedScore = applyConfidence(Math.min(125, rawScore), confidence)
  const finalScore = Math.min(100, Math.max(0, adjustedScore))

  // Propagate dealbreaker cap from base
  let cappedScore = finalScore
  if (base.dealbreakers.length > 0) cappedScore = Math.min(cappedScore, 44)
  if (listing.monthly_rent > profile.budget_max * 1.2) cappedScore = Math.min(cappedScore, 29)

  return {
    listing,
    score: cappedScore,
    rawScore,
    grade: toGrade(cappedScore),
    breakdown: {
      ...base.breakdown,
      location: locationScore,
      lifestyleDetail: lifestyleDetailScore,
    },
    confidence,
    semanticSimilarity: sim,
    reasons: base.reasons,
    dealbreakers: base.dealbreakers,
  }
}

/**
 * Batch match: tenant vs multiple listings.
 * Returns top `limit` results sorted by score desc.
 */
export async function aiMatchListings(
  profile: AiMatchTenantProfile,
  listings: AiMatchListing[],
  { limit = 10, semantic = false }: { limit?: number; semantic?: boolean } = {},
): Promise<AiMatchResult[]> {
  const results = await Promise.all(
    listings.map((l) => aiEnhancedMatchScore(profile, l, { semantic })),
  )
  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
