import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getAdminUser } from '@/lib/admin'
import { getContractReport, transitionContractReport } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { isComplianceGateError } from '@/lib/compliance-gates'

const transitionSchema = z.object({
  status: z.enum(['draft', 'in_review', 'ready', 'shared', 'revoked', 'expired']),
})

function errorResponse(request: Request, error: unknown) {
  if (isComplianceGateError(error)) {
    return jsonError(request, 503, 'B2B organization operations are unavailable', error.code)
  }
  const code = error instanceof Error ? error.message : 'CONTRACT_REPORT_FAILED'
  const status =
    code.endsWith('NOT_FOUND') ? 404 :
      code.includes('MUTATION_DENIED') || code.includes('REVIEW_REQUIRED') ? 403 :
        code.includes('INVALID_TRANSITION') ||
        code.includes('REVIEW_INCOMPLETE') ||
        code.includes('ORGANIZATION_INACTIVE') ? 409 : 500
  return jsonError(request, status, 'Failed to process contract report', code)
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const admin = await getAdminUser()
  const { id } = await context.params
  try {
    return jsonSuccess(request, { report: await getContractReport(user.id, id, Boolean(admin)) })
  } catch (error) {
    return errorResponse(request, error)
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const parsed = transitionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(request, 400, 'Invalid report transition', 'INVALID_PAYLOAD')
  const admin = await getAdminUser()
  const { id } = await context.params
  try {
    const report = await transitionContractReport(user.id, id, parsed.data.status, Boolean(admin))
    return jsonSuccess(request, { report })
  } catch (error) {
    return errorResponse(request, error)
  }
}
