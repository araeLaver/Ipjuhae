import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createContractReport, listContractReports } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'
import {
  isComplianceGateError,
  requireApprovedComplianceGate,
} from '@/lib/compliance-gates'

const createSchema = z.object({
  organizationId: z.string().uuid().nullish(),
  transactionId: z.string().uuid().nullish(),
  propertyId: z.string().uuid().nullish(),
  tenantId: z.string().uuid().nullish(),
  landlordId: z.string().uuid().nullish(),
  realtorId: z.string().uuid().nullish(),
  requesterRole: z.enum(['tenant', 'landlord', 'broker']),
  title: z.string().trim().min(2).max(160),
  contractAddress: z.string().trim().max(300).nullish(),
  contractStage: z.enum(['application', 'screening', 'negotiation', 'pre_contract', 'signed', 'completed']).default('pre_contract'),
  expiresAt: z.string().datetime().nullish(),
})

function errorResponse(request: Request, error: unknown) {
  if (isComplianceGateError(error)) {
    return jsonError(request, 503, 'B2B contract report operations are unavailable', error.code)
  }
  const code = error instanceof Error ? error.message : 'CONTRACT_REPORT_FAILED'
  const status = code.endsWith('ACCESS_DENIED') ? 403 : code.endsWith('NOT_FOUND') ? 404 : 500
  return jsonError(request, status, 'Failed to process contract report', code)
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  try {
    return jsonSuccess(request, { reports: await listContractReports(user.id) })
  } catch (error) {
    return errorResponse(request, error)
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')

  const parsed = createSchema.safeParse(await request.clone().json().catch(() => null))
  if (!parsed.success) {
    return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
  }

  if (parsed.data.organizationId) {
    try {
      await requireApprovedComplianceGate('b2b_api')
    } catch (error) {
      return errorResponse(request, error)
    }
  }

  return withIdempotency({
    request,
    namespace: 'contract-report-create',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    nonCacheableStatuses: [503],
    handler: async () => {
      try {
        const report = await createContractReport(user.id, parsed.data)
        return jsonSuccess(request, { report }, 201)
      } catch (error) {
        return errorResponse(request, error)
      }
    },
  })
}
