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
    // TEMP DIAGNOSTIC (cron-secret-gated; caller already authenticated above):
    // surface the real pg error so we can pinpoint the runtime cause. Remove after fix.
    const e = error as { message?: string; code?: string; detail?: string; table?: string; column?: string; routine?: string }
    const detail = [e.message, e.code && `code=${e.code}`, e.detail && `detail=${e.detail}`, e.table && `table=${e.table}`, e.column && `column=${e.column}`, e.routine && `routine=${e.routine}`].filter(Boolean).join(' | ')
    return jsonError(request, 500, `Trust maintenance failed: ${detail}`, 'TRUST_MAINTENANCE_FAILED')
  }
}

