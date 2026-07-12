import { query } from '@/lib/db'
import { AccessTargetType, ConsentTargetRole } from '@/types/database'

export interface AccessAuditInput {
  actorUserId: string | null
  actorRole: ConsentTargetRole | null
  actorIp: string | null
  actorUserAgent: string | null
  targetType: AccessTargetType
  targetId: string
  targetUserId: string | null
  purpose: string
  contractId?: string | null
  fieldsViewed: string[]
  requestId?: string | null
  traceId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function recordAccessAudit(input: AccessAuditInput): Promise<void> {
  try {
    const metadata = {
      ...(input.metadata ?? {}),
      ...(input.requestId ? { request_id: input.requestId } : {}),
      ...(input.traceId ? { trace_id: input.traceId } : {}),
    }

    await query(
      `INSERT INTO access_audit_logs
       (actor_user_id, actor_role, actor_ip, actor_user_agent, target_type, target_id, target_user_id, purpose, contract_id, fields_viewed, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.actorUserId,
        input.actorRole,
        input.actorIp,
        input.actorUserAgent,
        input.targetType,
        input.targetId,
        input.targetUserId,
        input.purpose,
        input.contractId ?? null,
        input.fieldsViewed,
        metadata,
      ]
    )
  } catch (error) {
    console.error('Access audit insert failed:', error)
  }
}
