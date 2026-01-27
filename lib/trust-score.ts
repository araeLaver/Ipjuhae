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

/**
 * 신뢰점수 계산
 * - 프로필 완성: 20점
 * - 재직 인증: 25점
 * - 소득 인증: 25점
 * - 신용 인증: 10-20점 (등급에 따라)
 * - 레퍼런스: +30점(긍정) / -20점(부정)
 * 최대: 120점 (100점 초과 가능)
 */
export function calculateTrustScore(input: TrustScoreInput): TrustScoreBreakdown {
  const { profile, verification, referenceResponses = [] } = input

  let profileScore = 0
  let employmentScore = 0
  let incomeScore = 0
  let creditScore = 0
  let referenceScore = 0

  // 1. 프로필 완성도 (20점)
  if (profile?.is_complete) {
    profileScore = 20
  }

  // 2. 재직 인증 (25점)
  if (verification?.employment_verified) {
    employmentScore = 25
  }

  // 3. 소득 인증 (25점)
  if (verification?.income_verified) {
    incomeScore = 25
  }

  // 4. 신용 인증 (10-20점)
  if (verification?.credit_verified && verification.credit_grade) {
    // 등급 1(최우량): 20점, 등급 2(양호): 15점, 등급 3(보통): 10점
    switch (verification.credit_grade) {
      case 1:
        creditScore = 20
        break
      case 2:
        creditScore = 15
        break
      case 3:
        creditScore = 10
        break
      default:
        creditScore = 10
    }
  }

  // 5. 레퍼런스 점수 (긍정: +30, 부정: -20)
  if (referenceResponses.length > 0) {
    for (const response of referenceResponses) {
      // 전체 평균이 3.5 이상이고 추천이면 긍정
      const avgScore = (
        response.rent_payment +
        response.property_condition +
        response.neighbor_issues +
        response.checkout_condition
      ) / 4

      if (response.would_recommend && avgScore >= 3.5) {
        referenceScore += 30
      } else if (!response.would_recommend || avgScore < 2.5) {
        referenceScore -= 20
      }
    }
  }

  const total = Math.max(0, profileScore + employmentScore + incomeScore + creditScore + referenceScore)

  return {
    profile: profileScore,
    employment: employmentScore,
    income: incomeScore,
    credit: creditScore,
    reference: referenceScore,
    total,
  }
}

/**
 * 신뢰점수 레벨 반환
 */
export function getTrustScoreLevel(score: number): 'excellent' | 'good' | 'fair' | 'low' {
  if (score >= 80) return 'excellent'
  if (score >= 50) return 'good'
  if (score >= 20) return 'fair'
  return 'low'
}

/**
 * 신뢰점수 레벨 라벨
 */
export function getTrustScoreLabel(score: number): string {
  const level = getTrustScoreLevel(score)
  switch (level) {
    case 'excellent':
      return '우수'
    case 'good':
      return '양호'
    case 'fair':
      return '보통'
    case 'low':
      return '시작'
  }
}

/**
 * 신뢰점수 색상
 */
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
  }
}
