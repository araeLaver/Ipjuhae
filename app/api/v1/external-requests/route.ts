import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne, transaction } from '@/lib/db'
import { trustDigest } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  sourceCode: z.string().min(1).max(80),
  subjectType: z.enum(['tenant', 'landlord', 'property']),
  subjectId: z.string().uuid(),
  purpose: z.string().min(1).max(80),
  consentId: z.string().uuid(),
  requestedFields: z.array(z.string().min(1).max(100)).min(1).max(100),
  expiresAt: z.string().datetime().nullish(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return jsonSuccess(request, { requests: await query(`SELECT request.id, source.code AS source_code, request.subject_type, request.subject_id, request.purpose, request.requested_fields, request.status, request.error_code, request.created_at, request.completed_at FROM trust_external_requests request JOIN trust_source_registry source ON source.id = request.source_id WHERE request.requested_by = $1 ORDER BY request.created_at DESC LIMIT 100`, [user.id]) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'trust-external-request',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      const source = await queryOne<{ id: string; allowed_fields: string[]; status: string }>(`SELECT id, allowed_fields, status FROM trust_source_registry WHERE code = $1`, [parsed.data.sourceCode])
      if (!source || source.status !== 'active') return jsonError(request, 404, 'Verification source unavailable', 'TRUST_SOURCE_UNAVAILABLE')
      const consent = await queryOne<{ user_id: string; status: string }>(`SELECT user_id, status FROM data_consents WHERE id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())`, [parsed.data.consentId])
      if (!consent || (parsed.data.subjectType !== 'property' && consent.user_id !== parsed.data.subjectId)) return jsonError(request, 403, 'Valid subject consent required', 'TRUST_EXTERNAL_CONSENT_INVALID')
      if (source.allowed_fields.length > 0 && parsed.data.requestedFields.some((field) => !source.allowed_fields.includes(field))) return jsonError(request, 403, 'Requested field is not allowed for this source', 'TRUST_EXTERNAL_FIELD_FORBIDDEN')
      const context = getRequestContext(request)
      const result = await transaction(async (client) => {
        const rows = await client.query(
          `INSERT INTO trust_external_requests (source_id, requested_by, subject_type, subject_id, purpose, consent_id, requested_fields, request_digest, status, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'authorized',$9) RETURNING *`,
          [source.id, user.id, parsed.data.subjectType, parsed.data.subjectId, parsed.data.purpose, parsed.data.consentId, parsed.data.requestedFields, trustDigest(parsed.data), parsed.data.expiresAt ?? null]
        )
        const externalRequest = rows.rows[0]
        await client.query(`INSERT INTO trust_outbox_events (aggregate_type, aggregate_id, event_type, payload, request_id, trace_id) VALUES ('external_request',$1,'ExternalVerificationRequested',$2,$3,$4)`, [externalRequest.id, JSON.stringify({ source_code: parsed.data.sourceCode, requested_fields: parsed.data.requestedFields }), context.requestId, context.traceId])
        return externalRequest
      })
      return jsonSuccess(request, { request: result }, 202)
    },
  })
}

