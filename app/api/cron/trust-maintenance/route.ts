import { runTrustMaintenance } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return jsonError(request, 401, 'Invalid cron authorization', 'CRON_AUTH_INVALID')
  }
  try {
    return jsonSuccess(request, await runTrustMaintenance(getRequestContext(request)))
  } catch (error) {
    console.error('Trust maintenance failed:', error)
    return jsonError(request, 500, 'Trust maintenance failed', 'TRUST_MAINTENANCE_FAILED')
  }
}

