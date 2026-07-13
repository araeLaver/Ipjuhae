import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { listAiProcessingRuns, recordAiProcessingRun } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  organizationId: z.string().uuid().nullish(),
  extractionJobId: z.string().uuid().nullish(),
  purpose: z.string().trim().min(2).max(300),
  provider: z.string().trim().min(2).max(100),
  modelName: z.string().trim().min(1).max(120),
  modelVersion: z.string().trim().max(120).nullish(),
  policyVersion: z.string().trim().max(120).nullish(),
  inputHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  outputHash: z.string().regex(/^[a-fA-F0-9]{64}$/).nullish(),
  containsPersonalData: z.boolean().default(false),
  consentId: z.string().uuid().nullish(),
  status: z.enum(['requested', 'running', 'completed', 'failed', 'cancelled']).default('requested'),
  costAmount: z.number().nonnegative().nullish(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return jsonSuccess(request, { runs: await listAiProcessingRuns(user.id) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'ai-processing-run',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) {
        return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      }
      try {
        return jsonSuccess(request, { run: await recordAiProcessingRun(user.id, parsed.data) }, 201)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'AI_RUN_CREATE_FAILED'
        return jsonError(request, code.endsWith('CONSENT_REQUIRED') ? 409 : 500, 'Failed to record AI run', code)
      }
    },
  })
}

