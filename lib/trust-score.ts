import { Profile, Verification, ReferenceResponse } from '@/types/database'

interface TrustScoreInput {
  profile?: Profile | null
  verification?: Verification | null
  referenceResponses?: ReferenceResponse[]
}

interface TrustScoreBreakdown {
  profile: number
  employment: number
  income: number
  credit: number
  reference: number
  total: number
}

export function calculateTrustScore(input: TrustScoreInput): TrustScoreBreakdown {
  const { profile, verification, referenceResponses = [] } = input

  let profileScore = 0
  let employmentScore = 0
  let incomeScore = 0
  let creditScore = 0
  let referenceScore = 0

  if (profile?.is_complete) {
    profileScore = 20
  }

  if (verification?.employment_verified) {
    employmentScore = 25
  }

  if (verification?.income_verified) {
    incomeScore = 25
  }

  if (verification?.credit_verified && verification.credit_grade) {
    switch (verification.credit_grade) {
      case 1:
        creditScore = 20
        break
      case 2:
        creditScore = 15
        break
      case 3:
      default:
        creditScore = 10
        break
    }
  }

  if (referenceResponses.length > 0) {
    const totalReferencePoints = referenceResponses.reduce((acc, response) => {
      const avgScore = (
        response.rent_payment +
        response.property_condition +
        response.neighbor_issues +
        response.checkout_condition
      ) / 4

      if (response.would_recommend && avgScore >= 3.5) {
        return acc + 30
      }
      if (!response.would_recommend || avgScore < 2.5) {
        return acc - 20
      }
      return acc
    }, 0)

    referenceScore = totalReferencePoints / referenceResponses.length
  }

  const clampedReferenceScore = Math.max(-20, Math.min(30, referenceScore))
  const clampedTotal = Math.max(
    0,
    Math.min(
      120,
      profileScore + employmentScore + incomeScore + creditScore + clampedReferenceScore
    )
  )

  return {
    profile: profileScore,
    employment: employmentScore,
    income: incomeScore,
    credit: creditScore,
    reference: clampedReferenceScore,
    total: clampedTotal,
  }
}

export function getTrustScoreLevel(score: number): 'excellent' | 'good' | 'fair' | 'low' {
  if (score >= 80) return 'excellent'
  if (score >= 50) return 'good'
  if (score >= 20) return 'fair'
  return 'low'
}

export function getTrustScoreLabel(score: number): string {
  const level = getTrustScoreLevel(score)
  switch (level) {
    case 'excellent':
      return '최고'
    case 'good':
      return '좋음'
    case 'fair':
      return '보통'
    case 'low':
      return '낮음'
    default:
      return '낮음'
  }
}

export function getTrustScoreColor(score: number): string {
  const level = getTrustScoreLevel(score)
  switch (level) {
    case 'excellent':
      return 'bg-green-500'
    case 'good':
      return 'bg-blue-500'
    case 'fair':
      return 'bg-yellow-500'
    case 'low':
      return 'bg-gray-400'
    default:
      return 'bg-gray-400'
  }
}
