import { dispatchTrustOutbox } from '@/lib/trust-outbox'
import { query } from '@/lib/db'
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
    // surface the real pg error + DB identity/search_path so we can pinpoint the
    // runtime cause (suspected runtime DB != migrated DB). Remove after fix.
    const e = error as { message?: string; code?: string; detail?: string; table?: string; column?: string; routine?: string }
    let probe = ''
    try {
      const rows = await query<{ db: string; sp: string; ipjuhae: string | null; pub: string | null }>(
        `SELECT current_database() AS db,
                current_setting('search_path') AS sp,
                to_regclass('ipjuhae.trust_outbox_events')::text AS ipjuhae,
                to_regclass('public.trust_outbox_events')::text AS pub`
      )
      const r = rows[0]
      probe = ` | db=${r?.db} | search_path=${r?.sp} | ipjuhae.trust_outbox_events=${r?.ipjuhae ?? 'MISSING'} | public.trust_outbox_events=${r?.pub ?? 'MISSING'}`
    } catch (probeErr) {
      probe = ` | probe_failed=${probeErr instanceof Error ? probeErr.message : String(probeErr)}`
    }
    const detail = [e.message, e.code && `code=${e.code}`, e.detail && `detail=${e.detail}`, e.table && `table=${e.table}`, e.column && `column=${e.column}`, e.routine && `routine=${e.routine}`].filter(Boolean).join(' | ')
    return jsonError(request, 500, `Trust outbox dispatch failed: ${detail}${probe}`, 'TRUST_OUTBOX_FAILED')
  }
}

