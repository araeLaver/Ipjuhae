import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { recordContractOutcome } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  outcome: z.enum(['completed', 'cancelled', 'defaulted', 'disputed', 'renewed']),
  terms: z.record(z.string(), z.unknown()).default({}),
  evidenceIds: z.array(z.string().uuid()).max(50).default([]),
  occurredAt: z.string().datetime(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params
  return withIdempotency({
    request,
    namespace: 'trust-contract-outcome',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      try {
        const outcome = await recordContractOutcome(id, user.id, parsed.data.outcome, parsed.data.terms, parsed.data.evidenceIds, parsed.data.occurredAt, getRequestContext(request))
        return jsonSuccess(request, { outcome }, 201)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'TRUST_OUTCOME_FAILED'
        return jsonError(request, code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : 500, 'Failed to record contract outcome', code)
      }
    },
  })
}

