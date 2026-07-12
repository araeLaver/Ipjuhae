import { getAdminUser } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function GET(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Administrator access required', 'ADMIN_REQUIRED')

  const [counts, outbox, risks, retention] = await Promise.all([
    queryOne<Record<string, string>>(`
      SELECT
        (SELECT COUNT(*) FROM trust_review_tasks WHERE status IN ('pending','reviewing'))::text AS pending_reviews,
        (SELECT COUNT(*) FROM trust_extraction_jobs WHERE status IN ('pending','scanning','extracting','review_required'))::text AS active_extractions,
        (SELECT COUNT(*) FROM trust_outbox_events WHERE published_at IS NULL)::text AS pending_outbox,
        (SELECT COUNT(*) FROM trust_outbox_events WHERE published_at IS NULL AND last_error IS NOT NULL)::text AS failed_outbox,
        (SELECT COUNT(*) FROM trust_disclosure_packages WHERE state = 'ISSUED' AND expires_at > NOW())::text AS active_disclosures,
        (SELECT COUNT(*) FROM trust_graph_edges WHERE state = 'QUARANTINED')::text AS quarantined_edges,
        (SELECT COUNT(*) FROM trust_retention_actions WHERE status = 'pending')::text AS pending_retention
    `),
    query(`SELECT id, aggregate_type, event_type, attempts, last_error, available_at, created_at, published_at FROM trust_outbox_events ORDER BY created_at DESC LIMIT 20`),
    query(`SELECT signal.signal_type, signal.signal_value, signal.threshold, signal.created_at, edge.state, edge.risk_score FROM trust_risk_signals signal LEFT JOIN trust_graph_edges edge ON edge.id = signal.edge_id ORDER BY signal.created_at DESC LIMIT 20`),
    query(`SELECT target_type, target_id, policy_code, action, status, scheduled_at, executed_at, exception_reason FROM trust_retention_actions ORDER BY created_at DESC LIMIT 20`),
  ])

  return jsonSuccess(request, { counts, outbox, risks, retention })
}

