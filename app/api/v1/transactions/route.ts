import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { createTrustTransaction } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  propertyId: z.string().uuid().nullish(),
  landlordId: z.string().uuid().nullish(),
  tenantId: z.string().uuid().nullish(),
  realtorId: z.string().uuid().nullish(),
  stage: z.enum([
    'pre_application',
    'application',
    'negotiation',
    'contract',
    'completed',
    'cancelled',
    'S0',
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
    'S6',
    'S7',
    'S8',
  ]).optional(),
  requirements: z.record(z.string(), z.unknown()).optional(),
  terms: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const transactions = await query(
    `SELECT * FROM trust_transaction_contexts
      WHERE landlord_id = $1 OR tenant_id = $1 OR realtor_id = $1
      ORDER BY created_at DESC LIMIT 100`,
    [user.id]
  )
  return jsonSuccess(request, { transactions })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'trust-transaction-create',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      const participantIds = [parsed.data.landlordId, parsed.data.tenantId, parsed.data.realtorId]
      if (!participantIds.includes(user.id) && user.user_type !== 'admin') return jsonError(request, 403, 'Creator must be a transaction participant', 'TRUST_TRANSACTION_FORBIDDEN')
      try {
        const result = await createTrustTransaction(parsed.data, user.id, getRequestContext(request))
        return jsonSuccess(request, { transaction: result }, 201)
      } catch (error) {
        console.error('Trust transaction create failed:', error)
        return jsonError(request, 500, 'Failed to create transaction context', 'TRUST_TRANSACTION_CREATE_FAILED')
      }
    },
  })
}
