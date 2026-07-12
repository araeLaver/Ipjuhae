import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { rankVerificationSources, type VerificationSourceCandidate } from '@/lib/trust-policy'
import { jsonError, jsonSuccess } from '@/lib/api-response'

const schema = z.object({
  requiredFields: z.array(z.string().min(1).max(100)).min(1).max(50),
  maxPrivacyRisk: z.number().min(0).max(1).default(1),
  weights: z.object({ reliability: z.number().min(0).max(1).optional(), cost: z.number().min(0).max(1).optional(), latency: z.number().min(0).max(1).optional(), privacy: z.number().min(0).max(1).optional() }).optional(),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
  const sources = await query<VerificationSourceCandidate>(
    `SELECT code, status, allowed_fields, reliability, estimated_cost, expected_latency_ms, privacy_risk
       FROM trust_source_registry WHERE status = 'active'`
  )
  return jsonSuccess(request, { paths: rankVerificationSources(sources, parsed.data.requiredFields, parsed.data.maxPrivacyRisk, parsed.data.weights) })
}

