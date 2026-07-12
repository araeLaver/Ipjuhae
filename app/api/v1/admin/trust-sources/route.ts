import { z } from 'zod'
import { getAdminUser } from '@/lib/admin'
import { query } from '@/lib/db'
import { jsonError, jsonSuccess } from '@/lib/api-response'

const schema = z.object({
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  sourceType: z.enum(['upload', 'direct_input', 'public_record', 'partner_api', 'ocr', 'manual_review']),
  authority: z.string().max(160).nullish(),
  allowedFields: z.array(z.string().max(100)).max(200).default([]),
  reliability: z.number().min(0).max(1),
  legalBasis: z.string().max(2000).nullish(),
  retentionDays: z.number().int().min(0).max(3650),
  automationLevel: z.enum(['manual', 'assisted', 'automatic']),
  estimatedCost: z.number().min(0).default(0),
  expectedLatencyMs: z.number().int().min(0).default(0),
  privacyRisk: z.number().min(0).max(1).default(0.5),
  status: z.enum(['active', 'disabled', 'legal_hold']).default('active'),
})

export async function GET(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Administrator access required', 'ADMIN_REQUIRED')
  return jsonSuccess(request, { sources: await query(`SELECT * FROM trust_source_registry ORDER BY code`) })
}

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Administrator access required', 'ADMIN_REQUIRED')
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
  const value = parsed.data
  const rows = await query(
    `INSERT INTO trust_source_registry
      (code, name, source_type, authority, allowed_fields, reliability, legal_basis, retention_days,
       automation_level, estimated_cost, expected_latency_ms, privacy_risk, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, source_type=EXCLUDED.source_type,
       authority=EXCLUDED.authority, allowed_fields=EXCLUDED.allowed_fields, reliability=EXCLUDED.reliability,
       legal_basis=EXCLUDED.legal_basis, retention_days=EXCLUDED.retention_days,
       automation_level=EXCLUDED.automation_level, estimated_cost=EXCLUDED.estimated_cost,
       expected_latency_ms=EXCLUDED.expected_latency_ms, privacy_risk=EXCLUDED.privacy_risk,
       status=EXCLUDED.status, updated_at=NOW()
     RETURNING *`,
    [value.code, value.name, value.sourceType, value.authority ?? null, value.allowedFields, value.reliability,
     value.legalBasis ?? null, value.retentionDays, value.automationLevel, value.estimatedCost,
     value.expectedLatencyMs, value.privacyRisk, value.status]
  )
  return jsonSuccess(request, { source: rows[0] }, 201)
}

