import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { updateTrustTransaction } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  stage: z.enum(['application', 'negotiation', 'contract', 'completed', 'cancelled']),
  requirements: z.record(z.string(), z.unknown()).optional(),
  terms: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params
  const context = await queryOne<Record<string, unknown>>(`SELECT * FROM trust_transaction_contexts WHERE id = $1 AND ($2 = landlord_id OR $2 = tenant_id OR $2 = realtor_id)`, [id, user.id])
  if (!context) return jsonError(request, 404, 'Transaction context not found', 'TRUST_TRANSACTION_NOT_FOUND')
  return jsonSuccess(request, { transaction: context })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params
  return withIdempotency({
    request,
    namespace: 'trust-transaction-stage',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      try {
        return jsonSuccess(request, await updateTrustTransaction(id, user.id, parsed.data.stage, parsed.data.requirements, parsed.data.terms, getRequestContext(request)))
      } catch (error) {
        const code = error instanceof Error ? error.message : 'TRUST_TRANSACTION_UPDATE_FAILED'
        return jsonError(request, code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('INVALID') ? 409 : 500, 'Failed to update transaction stage', code)
      }
    },
  })
}

