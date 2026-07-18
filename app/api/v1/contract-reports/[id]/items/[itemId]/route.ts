import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getAdminUser } from '@/lib/admin'
import { updateContractReportItem } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { isComplianceGateError } from '@/lib/compliance-gates'

const schema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'REVIEW_REQUIRED', 'MISSING', 'EXPIRED', 'REJECTED']),
  sourceType: z.enum(['upload', 'public_record', 'manual_review', 'partner_api', 'reference', 'direct_input']).nullish(),
  sourceName: z.string().trim().max(200).nullish(),
  sourceRef: z.string().trim().max(1000).nullish(),
  sourceObservedAt: z.string().datetime().nullish(),
  validUntil: z.string().datetime().nullish(),
  publicValue: z.unknown().optional(),
  missingReason: z.string().trim().max(1000).nullish(),
  nextAction: z.string().trim().max(1000).nullish(),
  reviewState: z.enum(['pending', 'approved', 'rejected']).optional(),
  notes: z.string().trim().max(2000).nullish(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
  }
  const admin = await getAdminUser()
  const { id, itemId } = await context.params
  try {
    const item = await updateContractReportItem(user.id, id, itemId, parsed.data, Boolean(admin))
    return jsonSuccess(request, { item })
  } catch (error) {
    if (isComplianceGateError(error)) {
      return jsonError(request, 503, 'B2B organization operations are unavailable', error.code)
    }
    const code = error instanceof Error ? error.message : 'CONTRACT_REPORT_ITEM_UPDATE_FAILED'
    const status =
      code.endsWith('NOT_FOUND') ? 404 :
        code.includes('MUTATION_DENIED') ? 403 :
          code.includes('ITEM_LOCKED') ||
          code.includes('ORGANIZATION_INACTIVE') ? 409 : 500
    return jsonError(request, status, 'Failed to update report item', code)
  }
}
