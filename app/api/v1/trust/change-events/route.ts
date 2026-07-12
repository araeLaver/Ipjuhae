import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { requestFactCorrection } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { getClientIp } from '@/lib/rate-limit'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  factId: z.string().uuid(),
  reason: z.string().min(10).max(2000),
  proposedValue: z.unknown(),
  evidenceIds: z.array(z.string().uuid()).max(20).default([]),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'trust-correction-request',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      try {
        const context = getRequestContext(request)
        const result = await requestFactCorrection(parsed.data.factId, user.id, parsed.data.reason, parsed.data.proposedValue, parsed.data.evidenceIds, { ...context, ip: getClientIp(request) })
        return jsonSuccess(request, result, 202)
      } catch (error) {
        console.error('Correction request failed:', error)
        const code = error instanceof Error ? error.message : 'TRUST_CORRECTION_FAILED'
        return jsonError(request, code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : 500, 'Failed to start correction chain', code)
      }
    },
  })
}

