import { query } from '@/lib/db'
import { Consent } from '@/types/database'

interface ConsentAccessContext {
  viewerUserId?: string | null
  ownerUserId: string
  viewerRole?: string | null
  targetType: Consent['resource_type']
  targetId: string
  targetPropertyId?: string | null
  requestedFields: string[]
  purpose?: string | null
  contractStage?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  enforceConsent?: boolean
}

interface ConsentAccessResult {
  allowed: boolean
  allowedFields: string[]
  canViewContact: boolean
}

const FIELD_WILDCARD = '*'
const CONTACT_FIELDS = new Set(['profile.contact', 'contact'])

function normalizeIpHeaderValue(requestIp: string | null): string | null {
  if (!requestIp) {
    return null
  }

  const firstIp = requestIp.split(',')[0]?.trim()
  return firstIp && firstIp.length > 0 ? firstIp : null
}

function projectAllowedFields(consent: Consent | null, requestedFields: string[]): string[] {
  if (requestedFields.length === 0) {
    return [FIELD_WILDCARD]
  }

  if (!consent) {
    return requestedFields
  }

  if (consent.allowed_fields.includes(FIELD_WILDCARD)) {
    return requestedFields
  }

  if (consent.allowed_fields.length === 0) {
    return []
  }

  const allowedSet = new Set(consent.allowed_fields)
  return requestedFields.filter((field) => allowedSet.has(field))
}

function removeContactFields(fields: string[], canViewContact: boolean): string[] {
  if (canViewContact) {
    return fields
  }

  return fields.filter((field) => !CONTACT_FIELDS.has(field))
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfIp = request.headers.get('cf-connecting-ip')

  return normalizeIpHeaderValue(forwarded) || normalizeIpHeaderValue(realIp) || normalizeIpHeaderValue(cfIp)
}

type ReferenceAccessContext = Omit<ConsentAccessContext, 'requestedFields' | 'targetType' | 'targetPropertyId'> & {
  requestedFields?: string[]
  targetType: 'reference'
  targetPropertyId?: string | null
  enforceConsent?: boolean
}

type ProfileAccessContext = Omit<ConsentAccessContext, 'targetType' | 'requestedFields'> & {
  requestedFields?: string[]
  targetType?: 'profile'
  enforceConsent?: boolean
}

export async function evaluateReferenceAccess(
  request: Request,
  context: ReferenceAccessContext,
): Promise<ConsentAccessResult & { accessLogId: string | null }> {
  return enforceConsentIfNeeded(
    request,
    {
      ...context,
      targetType: 'reference',
      requestedFields: context.requestedFields || [],
    },
  )
}

export async function evaluateProfileAccess(
  request: Request,
  context: ProfileAccessContext,
): Promise<ConsentAccessResult & { accessLogId: string | null }> {
  return enforceConsentIfNeeded(
    request,
    {
      ...context,
      targetType: 'profile',
      requestedFields: context.requestedFields || [],
    },
  )
}

export interface ReportAccessContext {
  viewerUserId: string
  ownerUserId: string
  viewerRole?: string | null
  viewerIsAdmin?: boolean
  targetType: Consent['resource_type']
  targetId: string
  targetPropertyId?: string | null
  requestedFields: string[]
  purpose: string
  contractStage?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ReportAccessResult extends ConsentAccessResult {
  accessLogId: string | null
  denialReason: 'missing_consent' | 'purpose_not_allowed' | 'no_allowed_fields' | null
}

export async function evaluateReportAccess(
  request: Request,
  context: ReportAccessContext,
): Promise<ReportAccessResult> {
  const {
    viewerUserId,
    ownerUserId,
    viewerRole,
    viewerIsAdmin = false,
    targetType,
    targetId,
    targetPropertyId,
    requestedFields,
    purpose,
    contractStage,
    ipAddress,
    userAgent,
  } = context

  if (viewerUserId === ownerUserId || viewerIsAdmin) {
    const allowedFields = requestedFields
    const accessLogId = await logAccess({
      viewerUserId,
      ownerUserId,
      targetType,
      targetId,
      targetPropertyId,
      allowedFields,
      purpose,
      contractStage,
      ipAddress: ipAddress ?? getClientIp(request),
      userAgent: userAgent ?? request.headers.get('user-agent') ?? null,
      result: 'granted',
    })

    return {
      allowed: true,
      allowedFields,
      canViewContact: true,
      accessLogId,
      denialReason: null,
    }
  }

  const matchingConsent = await loadMostSpecificConsent({
    ownerUserId,
    viewerUserId,
    viewerRole: viewerRole ?? null,
    targetType,
    targetId,
  })

  let denialReason: ReportAccessResult['denialReason'] = null
  let allowedFields: string[] = []
  let canViewContact = false

  if (!matchingConsent) {
    denialReason = 'missing_consent'
  } else if (!matchingConsent.allowed_purposes.includes(purpose)) {
    denialReason = 'purpose_not_allowed'
  } else {
    canViewContact = matchingConsent.can_view_contact === true
    allowedFields = removeContactFields(
      projectAllowedFields(matchingConsent, requestedFields),
      canViewContact,
    )

    if (allowedFields.length === 0) {
      denialReason = 'no_allowed_fields'
    }
  }

  const allowed = denialReason === null
  const accessLogId = await logAccess({
    viewerUserId,
    ownerUserId,
    targetType,
    targetId,
    targetPropertyId,
    allowedFields: allowed ? allowedFields : [],
    purpose,
    contractStage,
    ipAddress: ipAddress ?? getClientIp(request),
    userAgent: userAgent ?? request.headers.get('user-agent') ?? null,
    result: allowed ? 'granted' : 'denied',
  })

  return {
    allowed,
    allowedFields,
    canViewContact,
    accessLogId,
    denialReason,
  }
}

async function enforceConsentIfNeeded(
  request: Request,
  context: Omit<ConsentAccessContext, 'targetType' | 'requestedFields'> & {
    targetType: Consent['resource_type']
    requestedFields?: string[]
  },
): Promise<ConsentAccessResult & { accessLogId: string | null }> {
  const {
    viewerUserId,
    ownerUserId,
    viewerRole,
    targetType,
    targetId,
    targetPropertyId,
    requestedFields,
    purpose,
    contractStage,
    ipAddress,
    userAgent,
    enforceConsent = false,
  } = {
    requestedFields: [],
    ...context,
  }

  // 내 데이터 접근은 별도 동의 없이 허용
  if (viewerUserId && viewerUserId === ownerUserId) {
    const accessLogId = await logAccess({
      viewerUserId,
      ownerUserId,
      targetType,
      targetId,
      targetPropertyId,
      allowedFields: requestedFields,
      purpose,
      contractStage,
      ipAddress: ipAddress ?? getClientIp(request),
      userAgent: userAgent ?? request.headers.get('user-agent') ?? null,
      result: 'granted',
    })

    return {
      allowed: true,
      allowedFields: requestedFields,
      canViewContact: true,
      accessLogId,
    }
  }

  const matchingConsent = await loadMostSpecificConsent({
    ownerUserId,
    viewerUserId: viewerUserId ?? null,
    viewerRole: viewerRole ?? null,
    targetType,
    targetId,
  })

  const canViewContact = matchingConsent?.can_view_contact === true
  const hasConsent = Boolean(matchingConsent)
  const allowedFields = removeContactFields(
    hasConsent
      ? projectAllowedFields(matchingConsent, requestedFields)
      : requestedFields,
    canViewContact,
  )
  const allowed = hasConsent || !enforceConsent

  const accessLogId = viewerUserId
    ? await logAccess({
        viewerUserId,
        ownerUserId,
        targetType,
        targetId,
        targetPropertyId,
        allowedFields,
        purpose,
        contractStage,
        ipAddress: ipAddress ?? getClientIp(request),
        userAgent: userAgent ?? request.headers.get('user-agent') ?? null,
        result: allowed ? 'granted' : 'denied',
      })
    : null

  return {
    allowed,
    allowedFields,
    canViewContact,
    accessLogId,
  }
}

interface ConsentLookupInput {
  ownerUserId: string
  viewerUserId: string | null
  viewerRole: string | null
  targetType: Consent['resource_type']
  targetId: string
}

async function loadMostSpecificConsent({
  ownerUserId,
  viewerUserId,
  viewerRole,
  targetType,
  targetId,
}: ConsentLookupInput): Promise<Consent | null> {
  const rows = await query<Consent>(
    `SELECT *
       FROM consents
      WHERE owner_user_id = $1
        AND revoked_at IS NULL
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until >= NOW())
        AND (resource_type = 'all' OR resource_type = $2)
        AND (resource_id IS NULL OR resource_id = $3)
        AND (viewer_user_id IS NULL OR viewer_user_id = $4)
        AND (viewer_role IS NULL OR viewer_role = $5)
      ORDER BY (resource_id IS NULL) ASC,
               (viewer_user_id IS NULL) ASC,
               valid_from DESC
      LIMIT 1`,
    [ownerUserId, targetType, targetId, viewerUserId, viewerRole],
  )

  return rows[0] ?? null
}

interface LogAccessInput {
  viewerUserId: string
  ownerUserId: string
  targetType: Consent['resource_type']
  targetId: string
  targetPropertyId?: string | null
  allowedFields: string[]
  purpose?: string | null
  contractStage?: string | null
  ipAddress: string | null
  userAgent: string | null
  result: 'granted' | 'denied'
}

async function logAccess(params: LogAccessInput): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `INSERT INTO access_logs
      (viewer_user_id, owner_user_id, target_type, target_id, target_property_id, allowed_fields, purpose, ip_address, user_agent, contract_stage, result)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      params.viewerUserId,
      params.ownerUserId,
      params.targetType,
      params.targetId,
      params.targetPropertyId || null,
      params.allowedFields,
      params.purpose || null,
      params.ipAddress || null,
      params.userAgent || null,
      params.contractStage || null,
      params.result,
    ],
  )

  return rows[0]?.id ?? null
}
