import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createEvidenceFact } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { getClientIp } from '@/lib/rate-limit'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

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
      if (parsed.data.subjectType !== 'property' && parsed.data.subjectId !== user.id && user.user_type !== 'admin') {
        return jsonError(request, 403, 'Cannot submit evidence for this subject', 'TRUST_EVIDENCE_FORBIDDEN')
      }
      try {
        const context = getRequestContext(request)
        const result = await createEvidenceFact(parsed.data, user.id, { ...context, ip: getClientIp(request) })
        return jsonSuccess(request, result, 201)
      } catch (error) {
        console.error('Trust evidence create failed:', error)
        return jsonError(request, 500, 'Failed to create verification evidence', 'TRUST_EVIDENCE_CREATE_FAILED')
      }
    },
  })
}

