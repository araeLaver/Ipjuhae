import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/auth'
import { calculateDataScore } from '@/lib/trust-engine'
import { jsonError, jsonSuccess } from '@/lib/api-response'

// GET /api/v1/data-score — the caller's own DATA SCORE (evidence quality on the
// 5 criteria). Not behind the automated_scoring gate: it describes the quality
// of one's own submitted evidence, not an automated judgment about a person.
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')

  if (user.user_type !== 'tenant' && user.user_type !== 'landlord') {
    return jsonError(request, 400, 'No data score for this account type', 'DATA_SCORE_UNAVAILABLE')
  }
  const subjectType: 'tenant' | 'landlord' = user.user_type === 'landlord' ? 'landlord' : 'tenant'

  try {
    const result = await calculateDataScore(subjectType, user.id)
    return jsonSuccess(request, result)
  } catch (error) {
    logger.error('Data score failed', { error })
    return jsonError(request, 500, 'Failed to compute data score', 'DATA_SCORE_FAILED')
  }
}
