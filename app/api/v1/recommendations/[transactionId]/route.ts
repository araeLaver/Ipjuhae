import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { generateTransactionRecommendations } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'
import {
  isComplianceGateError,
  requireApprovedComplianceGate,
} from '@/lib/compliance-gates'

interface Params { params: Promise<{ transactionId: string }> }

export async function GET(request: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { transactionId } = await params
  const rows = await query(
    `SELECT rec.* FROM trust_condition_recommendations rec
      JOIN trust_transaction_contexts tx ON tx.id = rec.transaction_id
      WHERE rec.transaction_id = $1 AND ($2 = tx.landlord_id OR $2 = tx.tenant_id OR $2 = tx.realtor_id)
      ORDER BY rec.created_at DESC`,
    [transactionId, user.id]
  )
  return jsonSuccess(request, { recommendations: rows })
}

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { transactionId } = await params
  try {
    await requireApprovedComplianceGate('automated_scoring')
  } catch (error) {
    if (isComplianceGateError(error)) {
      return jsonError(request, 503, 'Automated recommendations are unavailable', error.code)
    }
    throw error
  }
  return withIdempotency({
    request,
    namespace: 'trust-condition-recommendations',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    nonCacheableStatuses: [503],
    handler: async () => {
      try {
        const result = await generateTransactionRecommendations(transactionId, user.id, getRequestContext(request))
        return jsonSuccess(request, result, 201)
      } catch (error) {
        if (isComplianceGateError(error)) {
          return jsonError(request, 503, 'Automated recommendations are unavailable', error.code)
        }
        const code = error instanceof Error ? error.message : 'TRUST_RECOMMENDATION_FAILED'
        return jsonError(request, code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : 500, 'Failed to generate transaction recommendations', code)
      }
    },
  })
}
