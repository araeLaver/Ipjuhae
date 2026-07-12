import { getCurrentUser } from '@/lib/auth'
import { getTrustReport } from '@/lib/trust-engine'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  try {
    return jsonSuccess(request, await getTrustReport(user.id))
  } catch (error) {
    console.error('Trust report failed:', error)
    return jsonError(request, 500, 'Failed to load trust report', 'TRUST_REPORT_FAILED')
  }
}

