import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query, transaction } from '@/lib/db'
import { trustDigest } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'
import {
  isComplianceGateError,
  requireApprovedComplianceGate,
} from '@/lib/compliance-gates'

const EXTERNAL_VERIFICATION_PURPOSE = 'external_verification'

const schema = z.object({
  sourceCode: z.string().min(1).max(80),
  subjectType: z.enum(['tenant', 'landlord', 'property']),
  subjectId: z.string().uuid(),
  purpose: z.string().min(1).max(80),
  consentId: z.string().uuid(),
  requestedFields: z
    .array(z.string().trim().min(1).max(100))
    .min(1)
    .max(100)
    .transform((fields) => [...new Set(fields)]),
  expiresAt: z.string().datetime().nullish(),
})

type ExternalRequestFailure = {
  ok: false
  status: 403 | 404
  message: string
  code: string
}

function failure(
  status: ExternalRequestFailure['status'],
  message: string,
  code: string,
): ExternalRequestFailure {
  return { ok: false, status, message, code }
}

function sourceAllowsFields(allowedFields: unknown, requestedFields: string[]): boolean {
  if (!Array.isArray(allowedFields) || !allowedFields.every((field) => typeof field === 'string')) {
    return false
  }
  return allowedFields.length > 0 && requestedFields.every((field) => allowedFields.includes(field))
}

function consentAllowsFields(allowedFields: unknown, requestedFields: string[]): boolean {
  if (Array.isArray(allowedFields)) {
    return (
      allowedFields.every((field) => typeof field === 'string') &&
      requestedFields.every((field) => allowedFields.includes(field))
    )
  }
  if (!allowedFields || typeof allowedFields !== 'object') return false
  const fields = allowedFields as Record<string, unknown>
  return requestedFields.every(
    (field) => Object.prototype.hasOwnProperty.call(fields, field) && fields[field] === true,
  )
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return jsonSuccess(request, { requests: await query(`SELECT request.id, source.code AS source_code, request.subject_type, request.subject_id, request.purpose, request.requested_fields, request.status, request.error_code, request.created_at, request.completed_at FROM trust_external_requests request JOIN trust_source_registry source ON source.id = request.source_id WHERE request.requested_by = $1 ORDER BY request.created_at DESC LIMIT 100`, [user.id]) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  try {
    await requireApprovedComplianceGate('external_data_access')
  } catch (error) {
    if (isComplianceGateError(error)) {
      return jsonError(request, 503, 'External verification is unavailable', error.code)
    }
    throw error
  }
  return withIdempotency({
    request,
    namespace: 'trust-external-request',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    nonCacheableStatuses: [503],
    handler: async () => {
      try {
        await requireApprovedComplianceGate('external_data_access')
      } catch (error) {
        if (isComplianceGateError(error)) {
          return jsonError(request, 503, 'External verification is unavailable', error.code)
        }
        throw error
      }
      const parsed = schema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')

      if (parsed.data.purpose !== EXTERNAL_VERIFICATION_PURPOSE) {
        return jsonError(request, 403, 'External verification purpose is not authorized', 'TRUST_EXTERNAL_PURPOSE_FORBIDDEN')
      }
      if (
        parsed.data.subjectType === 'property' ||
        !['tenant', 'landlord'].includes(parsed.data.subjectType) ||
        parsed.data.subjectType !== user.user_type ||
        parsed.data.subjectId !== user.id
      ) {
        return jsonError(request, 403, 'External verification subject is not authorized', 'TRUST_EXTERNAL_SUBJECT_FORBIDDEN')
      }

      const context = getRequestContext(request)
      try {
        const result = await transaction(async (client) => {
          await requireApprovedComplianceGate('external_data_access', client)

          const sourceResult = await client.query<{
            id: string
            allowed_fields: unknown
            status: string
            source_type: string
            automation_level: string
            legal_basis: string | null
            terms_reviewed_at: Date | string | null
            retention_days: number
          }>(
            `SELECT id, allowed_fields, status, source_type, automation_level,
                    legal_basis, terms_reviewed_at, retention_days
               FROM trust_source_registry
              WHERE code = $1
              FOR SHARE`,
            [parsed.data.sourceCode],
          )
          const source = sourceResult.rows[0]
          if (
            !source ||
            source.status !== 'active' ||
            !['partner_api', 'public_record'].includes(source.source_type) ||
            source.automation_level !== 'automatic' ||
            !source.legal_basis?.trim() ||
            !source.terms_reviewed_at ||
            !Number.isInteger(Number(source.retention_days)) ||
            Number(source.retention_days) < 1
          ) {
            return failure(404, 'Verification source unavailable', 'TRUST_SOURCE_UNAVAILABLE')
          }

          const consentResult = await client.query<{
            user_id: string
            status: string
            purpose: string
            target_role: string
            allowed_fields: unknown
            expires_at: Date | string | null
          }>(
            `SELECT user_id, status, purpose, target_role, allowed_fields, expires_at
               FROM data_consents
              WHERE id = $1
                AND status = 'active'
                AND (expires_at IS NULL OR expires_at > NOW())
              FOR SHARE`,
            [parsed.data.consentId],
          )
          const consent = consentResult.rows[0]
          if (
            !consent ||
            consent.status !== 'active' ||
            consent.purpose !== EXTERNAL_VERIFICATION_PURPOSE ||
            consent.target_role !== parsed.data.subjectType ||
            consent.user_id !== user.id ||
            consent.user_id !== parsed.data.subjectId
          ) {
            return failure(403, 'Valid subject consent required', 'TRUST_EXTERNAL_CONSENT_INVALID')
          }
          if (
            !sourceAllowsFields(source.allowed_fields, parsed.data.requestedFields) ||
            !consentAllowsFields(consent.allowed_fields, parsed.data.requestedFields)
          ) {
            return failure(403, 'Requested field is not authorized', 'TRUST_EXTERNAL_FIELD_FORBIDDEN')
          }

          const rows = await client.query(
            `WITH authorization AS (
               SELECT LEAST(
                 NOW() + INTERVAL '24 hours',
                 NOW() + make_interval(days => $10::int),
                 COALESCE($9::timestamptz, 'infinity'::timestamptz),
                 COALESCE($11::timestamptz, 'infinity'::timestamptz)
               ) AS expires_at
             )
             INSERT INTO trust_external_requests
               (source_id, requested_by, subject_type, subject_id, purpose, consent_id,
                requested_fields, request_digest, status, expires_at)
             SELECT $1,$2,$3,$4,$5,$6,$7,$8,'authorized',authorization.expires_at
               FROM authorization
              WHERE authorization.expires_at > NOW()
             RETURNING *`,
            [
              source.id,
              user.id,
              parsed.data.subjectType,
              parsed.data.subjectId,
              parsed.data.purpose,
              parsed.data.consentId,
              parsed.data.requestedFields,
              trustDigest(parsed.data),
              parsed.data.expiresAt ?? null,
              Number(source.retention_days),
              consent.expires_at ?? null,
            ]
          )
          const externalRequest = rows.rows[0]
          if (!externalRequest) {
            return failure(403, 'Valid subject consent required', 'TRUST_EXTERNAL_CONSENT_INVALID')
          }
          await client.query(`INSERT INTO trust_outbox_events (aggregate_type, aggregate_id, event_type, payload, request_id, trace_id) VALUES ('external_request',$1,'ExternalVerificationRequested',$2,$3,$4)`, [externalRequest.id, JSON.stringify({ source_code: parsed.data.sourceCode, requested_fields: parsed.data.requestedFields }), context.requestId, context.traceId])
          return { ok: true as const, externalRequest }
        })
        if (!result.ok) {
          return jsonError(request, result.status, result.message, result.code)
        }
        return jsonSuccess(request, { request: result.externalRequest }, 202)
      } catch (error) {
        if (isComplianceGateError(error)) {
          return jsonError(request, 503, 'External verification is unavailable', error.code)
        }
        throw error
      }
    },
  })
}
