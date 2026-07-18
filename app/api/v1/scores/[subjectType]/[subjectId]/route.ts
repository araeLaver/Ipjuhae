import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { calculateTrustScore, type TrustSubjectType } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { getClientIp } from '@/lib/rate-limit'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'
import {
  isComplianceGateError,
  requireApprovedComplianceGate,
} from '@/lib/compliance-gates'

interface Params { params: Promise<{ subjectType: string; subjectId: string }> }

function validSubject(value: string): value is TrustSubjectType {
  return ['tenant', 'landlord', 'property'].includes(value)
}

async function authorize(request: Request, params: Params) {
  const user = await getCurrentUser()
  const values = await params.params
  if (!user) return { error: jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED') }
  if (!validSubject(values.subjectType)) return { error: jsonError(request, 400, 'Invalid subject type', 'INVALID_SUBJECT_TYPE') }
  if (values.subjectType !== 'property' && values.subjectId !== user.id && user.user_type !== 'admin') {
    return { error: jsonError(request, 403, 'Score access denied', 'TRUST_SCORE_FORBIDDEN') }
  }
  return { user, subjectType: values.subjectType, subjectId: values.subjectId }
}

export async function GET(request: Request, params: Params) {
  const auth = await authorize(request, params)
  if ('error' in auth) return auth.error
  const runs = await query(
    `SELECT id, subject_type, subject_id, model_version, score, band, confidence, status,
            reason_codes, missing_fields, created_at
       FROM trust_score_runs
      WHERE subject_type = $1 AND subject_id = $2
      ORDER BY created_at DESC LIMIT 20`,
    [auth.subjectType, auth.subjectId]
  )
  return jsonSuccess(request, { runs })
}

export async function POST(request: Request, params: Params) {
  const auth = await authorize(request, params)
  if ('error' in auth) return auth.error
  try {
    await requireApprovedComplianceGate('automated_scoring')
  } catch (error) {
    if (isComplianceGateError(error)) {
      return jsonError(request, 503, 'Automated trust scoring is unavailable', error.code)
    }
    throw error
  }
  return withIdempotency({
    request,
    namespace: 'trust-score-calculate',
    key: request.headers.get('idempotency-key'),
    actorUserId: auth.user.id,
    nonCacheableStatuses: [503],
    handler: async () => {
      try {
        const context = getRequestContext(request)
        const run = await calculateTrustScore(auth.subjectType, auth.subjectId, auth.user.id, { ...context, ip: getClientIp(request) })
        return jsonSuccess(request, { run }, 201)
      } catch (error) {
        if (isComplianceGateError(error)) {
          return jsonError(request, 503, 'Automated trust scoring is unavailable', error.code)
        }
        console.error('Trust score calculation failed:', error)
        return jsonError(request, 500, 'Failed to calculate trust result', 'TRUST_SCORE_FAILED')
      }
    },
  })
}
