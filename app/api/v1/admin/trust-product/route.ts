import { z } from 'zod'
import { getAdminUser } from '@/lib/admin'
import { query, queryOne, transaction } from '@/lib/db'
import { listAllContractReports } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { COMPLIANCE_GATE_KEYS } from '@/lib/compliance-gates'

const experimentSchema = z.object({
  name: z.string().trim().min(2).max(200),
  experimentType: z.enum(['interview', 'sample_report', 'internal_test', 'pilot', 'pricing', 'broker_repeat', 'security']),
  targetSegment: z.string().trim().min(2).max(160),
  hypothesis: z.string().trim().min(2).max(2000),
  targetCount: z.number().int().nonnegative().nullish(),
  successCriteria: z.record(z.string(), z.unknown()).default({}),
  priceHypothesis: z.record(z.string(), z.unknown()).default({}),
  startsAt: z.string().date().nullish(),
  endsAt: z.string().date().nullish(),
})

const patchSchema = z.discriminatedUnion('resource', [
  z.object({
    resource: z.literal('document_intake'),
    id: z.string().uuid(),
    scanStatus: z.enum(['scanning', 'clean', 'quarantined', 'failed']),
    scanEngine: z.string().trim().max(120).nullish(),
    scanSignatureVersion: z.string().trim().max(120).nullish(),
    quarantineReason: z.string().trim().max(1000).nullish(),
  }),
  z.object({
    resource: z.literal('ai_run'),
    id: z.string().uuid(),
    humanReviewStatus: z.enum(['approved', 'corrected', 'rejected']),
    corrections: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
  z.object({
    resource: z.literal('experiment'),
    id: z.string().uuid(),
    status: z.enum(['planned', 'running', 'completed', 'cancelled']),
    actualCount: z.number().int().nonnegative(),
    actualMetrics: z.record(z.string(), z.unknown()).default({}),
    evidenceRefs: z.array(z.unknown()).default([]),
  }),
  z.object({
    resource: z.literal('compliance_gate'),
    id: z.enum(COMPLIANCE_GATE_KEYS),
    status: z.enum(['pending', 'approved', 'blocked']),
    approvalReference: z.string().trim().max(1000).nullish(),
    notes: z.string().trim().max(2000).nullish(),
  }),
])

export async function GET(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Admin access required', 'ADMIN_REQUIRED')
  const [reports, intakes, aiRuns, experiments, gates, gateHistory, organizations] = await Promise.all([
    listAllContractReports(),
    query('SELECT * FROM document_intakes ORDER BY created_at DESC LIMIT 200'),
    query('SELECT * FROM ai_processing_runs ORDER BY created_at DESC LIMIT 200'),
    query('SELECT * FROM validation_experiments ORDER BY created_at DESC LIMIT 200'),
    query('SELECT * FROM trust_compliance_gates ORDER BY gate_key'),
    query('SELECT * FROM trust_compliance_gate_events ORDER BY changed_at DESC, id DESC LIMIT 200'),
    query('SELECT * FROM trust_organizations ORDER BY created_at DESC LIMIT 100'),
  ])
  return jsonSuccess(request, {
    reports,
    intakes,
    ai_runs: aiRuns,
    experiments,
    gates,
    gate_history: gateHistory,
    organizations,
  })
}

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Admin access required', 'ADMIN_REQUIRED')
  const parsed = experimentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
  }
  const experiment = await queryOne(
    'INSERT INTO validation_experiments ' +
    '(name, experiment_type, target_segment, hypothesis, target_count, success_criteria, price_hypothesis, starts_at, ends_at, owner_user_id) ' +
    'VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10) RETURNING *',
    [
      parsed.data.name,
      parsed.data.experimentType,
      parsed.data.targetSegment,
      parsed.data.hypothesis,
      parsed.data.targetCount ?? null,
      JSON.stringify(parsed.data.successCriteria),
      JSON.stringify(parsed.data.priceHypothesis),
      parsed.data.startsAt ?? null,
      parsed.data.endsAt ?? null,
      admin.id,
    ]
  )
  return jsonSuccess(request, { experiment }, 201)
}

export async function PATCH(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Admin access required', 'ADMIN_REQUIRED')
  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) {
    return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
  }
  const input = parsed.data
  if (input.resource === 'document_intake') {
    const row = await queryOne(
      'UPDATE document_intakes SET scan_status = $2, scan_engine = $3, scan_signature_version = $4, quarantine_reason = $5, scanned_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
      [input.id, input.scanStatus, input.scanEngine ?? null, input.scanSignatureVersion ?? null, input.quarantineReason ?? null]
    )
    return jsonSuccess(request, { document_intake: row })
  }
  if (input.resource === 'ai_run') {
    const row = await queryOne(
      'UPDATE ai_processing_runs SET human_review_status = $2, corrections = $3::jsonb, reviewer_id = $4, reviewed_at = NOW() WHERE id = $1 RETURNING *',
      [input.id, input.humanReviewStatus, JSON.stringify(input.corrections), admin.id]
    )
    return jsonSuccess(request, { ai_run: row })
  }
  if (input.resource === 'experiment') {
    const row = await queryOne(
      'UPDATE validation_experiments SET status = $2, actual_count = $3, actual_metrics = $4::jsonb, evidence_refs = $5::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *',
      [input.id, input.status, input.actualCount, JSON.stringify(input.actualMetrics), JSON.stringify(input.evidenceRefs)]
    )
    return jsonSuccess(request, { experiment: row })
  }
  if (input.status === 'approved' && !input.approvalReference?.trim()) {
    return jsonError(
      request,
      400,
      'An approval reference is required to approve a compliance gate',
      'COMPLIANCE_GATE_APPROVAL_REFERENCE_REQUIRED',
    )
  }
  const row = await transaction(async (client) => {
    await client.query(
      `SELECT set_config('app.compliance_actor_id', $1, TRUE)`,
      [admin.id],
    )
    const currentResult = await client.query<Record<string, unknown>>(
      'SELECT * FROM trust_compliance_gates WHERE gate_key = $1 FOR UPDATE',
      [input.id],
    )
    const current = currentResult.rows[0]
    if (!current) return null

    const updatedResult = await client.query<Record<string, unknown>>(
      'UPDATE trust_compliance_gates SET status = $2, approval_reference = $3, notes = $4, approved_by = CASE WHEN $2 = \'approved\' THEN $5::uuid ELSE NULL END, approved_at = CASE WHEN $2 = \'approved\' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE gate_key = $1 RETURNING *',
      [input.id, input.status, input.approvalReference ?? null, input.notes ?? null, admin.id],
    )
    const updated = updatedResult.rows[0]
    if (!updated) return null
    return updated
  })
  if (!row) {
    return jsonError(request, 404, 'Compliance gate not found', 'COMPLIANCE_GATE_NOT_FOUND')
  }
  return jsonSuccess(request, { compliance_gate: row })
}
