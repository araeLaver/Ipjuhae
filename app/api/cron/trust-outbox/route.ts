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
    return jsonError(request, 500, 'Trust outbox dispatch failed', 'TRUST_OUTBOX_FAILED')
  }
}

