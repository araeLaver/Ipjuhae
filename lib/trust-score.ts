import { Profile, Verification, ReferenceResponse, ReferenceResponseItem, ValidationValue } from '@/types/database'

type ReferenceDisputeStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'

export interface TrustScoreInput {
  profile?: Profile | null
  verification?: Verification | null
  referenceResponses?: ReferenceResponse[]
  referenceResponseItems?: ReferenceResponseItem[]
  validationValues?: ValidationValue[]
  referenceDisputes?: Array<{ request_status: string }>
  propertySafetyScore?: number | null
}

export const MAX_TRUST_SCORE = 145

export interface TrustScoreBreakdown {
  profile: number
  employment: number
  income: number
  credit: number
  reference: number
  validation: number
  disputePenalty: number
  propertySafety: number
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

const VALIDATION_SCORE_PER_SOURCE = 5
const VALIDATION_SCORE_MAX = 15
const DISPUTE_PENALTY_UNIT = 5
const DISPUTE_PENALTY_MAX = 30
const PROPERTY_SAFETY_MAX = 10

function calculateValidationScore(validationValues: ValidationValue[] = []): number {
  const validKeys = validationValues.filter((value) => value.status === 'valid')

  const hasEmploymentProof = validKeys.some((value) => value.validation_key.startsWith('employment_ocr'))
  const hasIncomeProof = validKeys.some((value) => value.validation_key.startsWith('income_ocr'))
  const hasCreditProof = validKeys.some((value) => value.validation_key.startsWith('credit_ocr'))

  const activeSources = Number(hasEmploymentProof) + Number(hasIncomeProof) + Number(hasCreditProof)
  return Math.min(activeSources * VALIDATION_SCORE_PER_SOURCE, VALIDATION_SCORE_MAX)
}

function calculateDisputePenalty(
  referenceDisputes: Array<{ request_status: string }> = [],
): number {
  const pendingOrReviewing = referenceDisputes.filter(
    ({ request_status }) =>
      request_status === ('pending' as ReferenceDisputeStatus) ||
      request_status === ('reviewing' as ReferenceDisputeStatus),
  ).length

  if (!pendingOrReviewing) {
    return 0
  }

  return -Math.min(pendingOrReviewing * DISPUTE_PENALTY_UNIT, DISPUTE_PENALTY_MAX)
}

function calculatePropertySafetyScore(propertySafetyScore: number | null): number {
  if (!Number.isFinite(propertySafetyScore)) {
    return 0
  }

  if (propertySafetyScore === null) {
    return 0
  }

  return Math.max(0, Math.min(PROPERTY_SAFETY_MAX, Math.round(propertySafetyScore / 12)))
}

/**
 * 프로필 요약값 계산
 * - 프로필 완성: 20점
 * - 재직 인증: 25점
 * - 소득 인증: 25점
 * - 신용 관련 확인: 10-20점 (등급에 따라)
 * - 레퍼런스: +30점(긍정) / -20점(부정)
 * 최대: 120점 (100점 초과 가능)
 */
export function calculateTrustScore(input: TrustScoreInput): TrustScoreBreakdown {
  const {
    profile,
    verification,
    referenceResponses = [],
    referenceResponseItems = [],
    validationValues = [],
    referenceDisputes = [],
    propertySafetyScore = null,
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

  // 4. 신용 관련 확인 (10-20점)
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

  // 6. 서류 검증값 기반 추가 점수
  const validationScore = calculateValidationScore(validationValues)

  // 7. 분쟁/정정 요청 페널티
  const disputePenalty = calculateDisputePenalty(referenceDisputes)

  // 8. 주택 안전점수 기반 보정 (공동주택/단지 기반 보정)
  const propertySafety = calculatePropertySafetyScore(propertySafetyScore ?? null)

  const total = Math.max(
    0,
    profileScore +
      employmentScore +
      incomeScore +
      creditScore +
      referenceScore +
      validationScore +
      disputePenalty +
      propertySafety,
  )

  return {
    profile: profileScore,
    employment: employmentScore,
    income: incomeScore,
    credit: creditScore,
    reference: referenceScore,
    validation: validationScore,
    disputePenalty,
    propertySafety,
    total,
  }
}

/**
 * 프로필 요약 레벨 반환
 */
export function getTrustScoreLevel(score: number): 'excellent' | 'good' | 'fair' | 'low' {
  if (score >= 100) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 30) return 'fair'
  return 'low'
}

/**
 * 프로필 요약 레벨 라벨
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
 * 프로필 요약 색상
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
