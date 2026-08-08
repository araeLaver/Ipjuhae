import { dispatchTrustOutbox } from '@/lib/trust-outbox'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return jsonError(request, 401, 'Invalid cron authorization', 'CRON_AUTH_INVALID')
  }
  try {
    return jsonSuccess(request, await dispatchTrustOutbox(50))
  } catch (error) {
    console.error('Trust outbox dispatch failed:', error)
    // TEMP DIAGNOSTIC (cron-secret-gated; caller already authenticated above):
    // surface the real pg error so we can pinpoint the runtime cause. Remove after fix.
    const e = error as { message?: string; code?: string; detail?: string; table?: string; column?: string; routine?: string }
    const detail = [e.message, e.code && `code=${e.code}`, e.detail && `detail=${e.detail}`, e.table && `table=${e.table}`, e.column && `column=${e.column}`, e.routine && `routine=${e.routine}`].filter(Boolean).join(' | ')
    return jsonError(request, 500, `Trust outbox dispatch failed: ${detail}`, 'TRUST_OUTBOX_FAILED')
  }
}

