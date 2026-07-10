import { query, queryOne } from '@/lib/db'
import { calculateTrustScore, getTrustScoreLevel } from '@/lib/trust-score'
import type {
  Profile,
  Verification,
  ReferenceResponse,
  ReferenceResponseItem,
  ReferenceDispute,
  ValidationValue,
  PropertySafetyScore,
} from '@/types/database'

export const PROPERTY_SAFETY_FIELDS = [
  'report.summary',
  'report.status_flags',
  'property.safety_summary',
  'property.risk_flags',
  'property.safety_snapshot',
  'evidence.metadata',
  'profile.contact',
]

export const LANDLORD_TRUST_FIELDS = [
  'report.summary',
  'report.status_flags',
  'profile.basic',
  'profile.contact',
  'trust.overall_signal',
  'trust.score_breakdown',
  'verification.summary',
  'verification.detail',
  'validation.values',
  'reference.summary',
  'reference.detail',
  'reference.disputes',
]

export const TENANT_TRUST_FIELDS = LANDLORD_TRUST_FIELDS

const ALLOWED_FIELD_SET = new Set([
  ...PROPERTY_SAFETY_FIELDS,
  ...LANDLORD_TRUST_FIELDS,
  'trade.hints',
  'access.history',
])

interface ProfileReportData {
  profile: Profile
  verification: Verification | null
  referenceResponses: ReferenceResponse[]
  referenceResponseItems: ReferenceResponseItem[]
  referenceDisputes: ReferenceDispute[]
  validationValues: ValidationValue[]
  propertySafetyScore: number | null
}

interface PropertyRow {
  id: string
  landlord_id: string
  title: string
  region: string | null
  property_type: string
  status: string
  updated_at: Date
}

export function parsePurpose(searchParams: URLSearchParams): string | null {
  const purpose = searchParams.get('purpose')?.trim()
  return purpose || null
}

export function parseContractStage(searchParams: URLSearchParams): string | null {
  const contractStage = searchParams.get('contractStage')?.trim()
  return contractStage || null
}

export function parseRequestedFields(
  searchParams: URLSearchParams,
  presetFields: string[],
): string[] {
  const raw = searchParams.get('fields')
  if (!raw) {
    return presetFields
  }

  const requested = raw
    .split(',')
    .map((field) => field.trim())
    .filter((field) => ALLOWED_FIELD_SET.has(field))

  return requested.length > 0 ? requested : presetFields
}

export function hasField(fields: string[], key: string): boolean {
  return fields.includes(key)
}

export async function loadProfileReportData(
  profileId: string,
  subjectType: 'tenant' | 'landlord',
): Promise<ProfileReportData | null> {
  const profile = await queryOne<Profile>(
    'SELECT * FROM profiles WHERE id = $1 AND is_complete = true',
    [profileId],
  )

  if (!profile) {
    return null
  }

  const verification = await queryOne<Verification>(
    'SELECT * FROM verifications WHERE user_id = $1',
    [profile.user_id],
  )

  const referenceResponses = await query<ReferenceResponse>(
    `SELECT rr.*
       FROM reference_responses rr
       JOIN landlord_references lr ON rr.reference_id = lr.id
      WHERE COALESCE(lr.subject_user_id, lr.user_id) = $1
        AND lr.status = 'completed'`,
    [profile.user_id],
  )

  const responseIds = referenceResponses.map((response) => response.id)
  const referenceResponseItems = responseIds.length === 0
    ? []
    : await query<ReferenceResponseItem>(
        `SELECT *
           FROM reference_response_items
          WHERE response_id = ANY($1::uuid[])`,
        [responseIds],
      )

  const referenceDisputes = responseIds.length === 0
    ? []
    : await query<ReferenceDispute>(
        `SELECT rd.*
           FROM reference_disputes rd
          WHERE rd.response_id = ANY($1::uuid[])`,
        [responseIds],
      )

  const validationValues = await query<ValidationValue>(
    `SELECT *
       FROM validation_values
      WHERE owner_user_id = $1
        AND subject_type = $2
        AND (subject_id IS NULL OR subject_id = $1)`,
    [profile.user_id, subjectType],
  )

  return {
    profile,
    verification,
    referenceResponses,
    referenceResponseItems,
    referenceDisputes,
    validationValues,
    propertySafetyScore: null,
  }
}

export async function loadProperty(propertyId: string): Promise<PropertyRow | null> {
  return queryOne<PropertyRow>(
    `SELECT id, landlord_id, title, region, property_type, status, updated_at
       FROM properties
      WHERE id = $1
        AND status != 'hidden'`,
    [propertyId],
  )
}

export async function loadPropertySafetyScore(
  propertyId: string,
): Promise<PropertySafetyScore | null> {
  return queryOne<PropertySafetyScore>(
    `SELECT *
       FROM property_safety_scores
      WHERE property_id = $1`,
    [propertyId],
  )
}

export function buildProfileTrustReport(
  data: ProfileReportData,
  allowedFields: string[],
  reportType: 'landlord_trust' | 'tenant_trust',
) {
  const statusFlags = new Set<string>()
  const pendingDisputes = data.referenceDisputes.filter((dispute) =>
    dispute.request_status === 'pending' || dispute.request_status === 'reviewing'
  )
  const nonValidValues = data.validationValues.filter((value) => value.status !== 'valid')

  if (pendingDisputes.length > 0) {
    statusFlags.add('검토 중')
  }

  if (nonValidValues.length > 0) {
    statusFlags.add('추가 확인 필요')
  }

  const scoreBreakdown = calculateTrustScore({
    profile: data.profile,
    verification: data.verification,
    referenceResponses: data.referenceResponses,
    referenceResponseItems: data.referenceResponseItems,
    referenceDisputes: data.referenceDisputes,
    validationValues: data.validationValues.filter((value) => value.status === 'valid'),
    propertySafetyScore: data.propertySafetyScore,
  })
  const report: Record<string, unknown> = {}

  if (hasField(allowedFields, 'report.summary')) {
    report.report = {
      type: reportType,
      generatedAt: new Date().toISOString(),
      summary: '확인 항목 기반 신뢰 리포트',
    }
  }

  if (hasField(allowedFields, 'report.status_flags')) {
    report.statusFlags = Array.from(statusFlags)
  }

  if (hasField(allowedFields, 'profile.basic') || hasField(allowedFields, 'profile.contact')) {
    const profile: Record<string, unknown> = {}

    if (hasField(allowedFields, 'profile.basic')) {
      profile.basic = {
        userType: reportType === 'tenant_trust' ? 'tenant' : 'landlord',
        ageRange: data.profile.age_range,
        familyType: data.profile.family_type,
        isComplete: data.profile.is_complete,
      }
    }

    if (hasField(allowedFields, 'profile.contact')) {
      profile.contact = {
        name: data.profile.name,
      }
    }

    report.profile = profile
  }

  if (hasField(allowedFields, 'trust.overall_signal')) {
    report.trust = {
      overallSignal: getTrustSignal(scoreBreakdown.total),
      level: getTrustScoreLevel(scoreBreakdown.total),
    }
  }

  if (hasField(allowedFields, 'trust.score_breakdown')) {
    report.trust = {
      ...(report.trust as Record<string, unknown> | undefined),
      scoreBreakdown,
    }
  }

  if (hasField(allowedFields, 'verification.summary') && data.verification) {
    report.verification = {
      summary: {
        employment: data.verification.employment_verified ? '확인 항목' : '추가 확인 필요',
        income: data.verification.income_verified ? '확인 항목' : '추가 확인 필요',
        credit: data.verification.credit_verified ? '확인 항목' : '추가 확인 필요',
      },
    }
  }

  if (hasField(allowedFields, 'verification.detail') && data.verification) {
    report.verification = {
      ...(report.verification as Record<string, unknown> | undefined),
      detail: {
        employmentCompany: data.verification.employment_verified ? data.verification.employment_company : null,
        incomeRange: data.verification.income_verified ? data.verification.income_range : null,
        creditGrade: data.verification.credit_verified ? data.verification.credit_grade : null,
      },
    }
  }

  if (hasField(allowedFields, 'validation.values')) {
    report.validation = {
      values: data.validationValues.map((value) => ({
        key: value.validation_key,
        status: value.status === 'valid' ? '확인 항목' : mapReviewStatus(value.status),
        flag: value.validation_flag,
      })),
    }
  }

  if (hasField(allowedFields, 'reference.summary')) {
    report.reference = {
      summary: {
        completedCount: data.referenceResponses.length,
        recommendCount: data.referenceResponses.filter((response) => response.would_recommend).length,
      },
    }
  }

  if (hasField(allowedFields, 'reference.detail')) {
    report.reference = {
      ...(report.reference as Record<string, unknown> | undefined),
      detail: data.referenceResponses.map((response) => ({
        id: response.id,
        wouldRecommend: response.would_recommend,
        overallRating: response.overall_rating,
      })),
    }
  }

  if (hasField(allowedFields, 'reference.disputes')) {
    report.reference = {
      ...(report.reference as Record<string, unknown> | undefined),
      disputes: data.referenceDisputes.map((dispute) => ({
        id: dispute.id,
        status: dispute.request_status === 'pending' || dispute.request_status === 'reviewing'
          ? '검토 중'
          : dispute.request_status,
      })),
    }
  }

  return report
}

export function buildPropertySafetyReport(
  property: PropertyRow,
  safetyScore: PropertySafetyScore | null,
  allowedFields: string[],
) {
  const report: Record<string, unknown> = {}
  const expired = Boolean(safetyScore?.expires_at && new Date(safetyScore.expires_at) < new Date())
  const statusFlags = expired ? ['최신 확인 필요', 'expired'] : []

  if (hasField(allowedFields, 'report.summary')) {
    report.report = {
      type: 'property_safety',
      generatedAt: new Date().toISOString(),
      summary: '주택 안전 확인 항목 리포트',
    }
  }

  if (hasField(allowedFields, 'report.status_flags')) {
    report.statusFlags = statusFlags
  }

  if (hasField(allowedFields, 'property.safety_summary')) {
    report.property = {
      safetySummary: {
        propertyId: property.id,
        title: property.title,
        region: property.region,
        propertyType: property.property_type,
        status: expired ? '최신 확인 필요' : '확인 항목',
      },
    }
  }

  if (hasField(allowedFields, 'property.risk_flags')) {
    report.property = {
      ...(report.property as Record<string, unknown> | undefined),
      riskFlags: expired ? [] : safetyScore?.risk_flags ?? [],
    }
  }

  if (hasField(allowedFields, 'property.safety_snapshot')) {
    report.property = {
      ...(report.property as Record<string, unknown> | undefined),
      safetySnapshot: expired ? { status: '최신 확인 필요' } : safetyScore?.safety_snapshot ?? {},
    }
  }

  if (hasField(allowedFields, 'evidence.metadata')) {
    report.evidence = {
      metadata: {
        latestSafetyCheckAt: safetyScore?.updated_at ?? null,
        expiresAt: safetyScore?.expires_at ?? null,
      },
    }
  }

  if (hasField(allowedFields, 'profile.contact')) {
    report.ownerContact = {
      ownerUserId: property.landlord_id,
    }
  }

  return report
}

function getTrustSignal(score: number): '확인 항목 충분' | '보통' | '추가 확인 필요' {
  if (score >= 90) {
    return '확인 항목 충분'
  }

  if (score >= 50) {
    return '보통'
  }

  return '추가 확인 필요'
}

function mapReviewStatus(status: ValidationValue['status']): string {
  switch (status) {
    case 'valid':
      return '확인 항목'
    case 'needs_review':
      return '추가 확인 필요'
    case 'disputed':
      return '위험 신호'
    case 'stale':
      return '최신 확인 필요'
  }
}
