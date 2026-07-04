import { Profile, Verification, ReferenceResponse, ReferenceResponseItem } from '@/types/database'

interface TrustScoreInput {
  profile?: Profile | null
  verification?: Verification | null
  referenceResponses?: ReferenceResponse[]
  referenceResponseItems?: ReferenceResponseItem[]
}

export interface TrustScoreBreakdown {
  profile: number
  employment: number
  income: number
  credit: number
  reference: number
  total: number
}

type ReferenceItemAverages = {
  responseId: string
  avgScore: number
}

function getReferenceItemAverages(items: ReferenceResponseItem[]): ReferenceItemAverages[] {
  const byResponse = new Map<string, number[]>()

  for (const item of items) {
    const arr = byResponse.get(item.response_id) ?? []
    arr.push(item.item_score)
    byResponse.set(item.response_id, arr)
  }

  const result: ReferenceItemAverages[] = []
  for (const [responseId, scores] of byResponse.entries()) {
    if (!scores.length) {
      continue
    }

    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    result.push({ responseId, avgScore })
  }

  return result
}

function getAvgFromLegacyResponse(response: ReferenceResponse): number {
  return (
    response.rent_payment +
    response.property_condition +
    response.neighbor_issues +
    response.checkout_condition
  ) / 4
}

function calcReferenceScore(
  response: ReferenceResponse,
  itemAveragesByResponseId: Map<string, ReferenceItemAverages>,
): number {
  const itemAverage = itemAveragesByResponseId.get(response.id)?.avgScore
  const avgScore = itemAverage ?? getAvgFromLegacyResponse(response)

  if (response.would_recommend && avgScore >= 3.5) {
    return 30
  }

  if (!response.would_recommend || avgScore < 2.5) {
    return -20
  }

  return 0
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
  const {
    profile,
    verification,
    referenceResponses = [],
    referenceResponseItems = [],
  } = input

  let profileScore = 0
  let employmentScore = 0
  let incomeScore = 0
  let creditScore = 0
  let referenceScore = 0
  const itemAveragesByResponseId = new Map(
    getReferenceItemAverages(referenceResponseItems).map((item) => [item.responseId, item]),
  )

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
      referenceScore += calcReferenceScore(response, itemAveragesByResponseId)
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
