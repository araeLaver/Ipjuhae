import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { createEvidenceFact } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { getClientIp } from '@/lib/rate-limit'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

// Sources a non-admin caller may self-submit under. Reviewer/operator-grade
// sources (e.g. human_review, 0.90 reliability) can only be set by admins —
// clients must never be able to mint "verified" evidence about themselves.
const SELF_SERVICE_SOURCES = new Set(['user_direct', 'user_upload'])

const schema = z.object({
  subjectType: z.enum(['tenant', 'landlord', 'property']),
  subjectId: z.string().uuid(),
  propertyId: z.string().uuid().nullish(),
  sourceCode: z.string().min(1).max(80),
  fieldName: z.string().min(1).max(100),
  normalizedValue: z.unknown(),
  objectHash: z.string().length(64).nullish(),
  storageRef: z.string().max(1000).nullish(),
  issuedAt: z.string().datetime().nullish(),
  validUntil: z.string().datetime().nullish(),
  consentId: z.string().uuid().nullish(),
  extractionConfidence: z.number().min(0).max(1).nullish(),
  humanReviewed: z.boolean().optional(),
  reasonCodes: z.array(z.string().max(100)).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const key = request.headers.get('idempotency-key')
  return withIdempotency({
    request,
    namespace: 'trust-evidence-create',
    key,
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')

      const data = parsed.data
      const isAdmin = user.user_type === 'admin'

      if (!isAdmin) {
        // Authorization: a caller may only submit evidence about themselves or a
        // property they own. (Previously `property` bypassed all checks, letting
        // anyone poison any property's trust facts.)
        if (data.subjectType === 'property') {
          const owns = await queryOne<{ id: string }>(
            'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
            [data.subjectId, user.id]
          )
          if (!owns) return jsonError(request, 403, 'Cannot submit evidence for this property', 'TRUST_EVIDENCE_FORBIDDEN')
        } else if (data.subjectId !== user.id) {
          return jsonError(request, 403, 'Cannot submit evidence for this subject', 'TRUST_EVIDENCE_FORBIDDEN')
        }

        // Clients cannot self-certify: reject reviewer-grade sources and never
        // honour a client-supplied humanReviewed flag.
        if (!SELF_SERVICE_SOURCES.has(data.sourceCode)) {
          return jsonError(request, 403, 'This evidence source requires operator verification', 'TRUST_SOURCE_FORBIDDEN')
        }
        data.humanReviewed = false
      }

      try {
        const context = getRequestContext(request)
        const result = await createEvidenceFact(data, user.id, { ...context, ip: getClientIp(request) })
        return jsonSuccess(request, result, 201)
      } catch (error) {
        console.error('Trust evidence create failed:', error)
        return jsonError(request, 500, 'Failed to create verification evidence', 'TRUST_EVIDENCE_CREATE_FAILED')
      }
    },
  })
}

