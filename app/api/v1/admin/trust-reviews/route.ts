import { z } from 'zod'
import { getAdminUser } from '@/lib/admin'
import { query } from '@/lib/db'
import { decideFactCorrection } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  taskId: z.string().uuid(),
  decision: z.enum(['accepted', 'partially_accepted', 'rejected']),
  decisionReason: z.string().min(5).max(2000),
  correctedValue: z.unknown(),
})

export async function GET(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Administrator access required', 'ADMIN_REQUIRED')
  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? 'pending'
  const tasks = await query(
    `SELECT * FROM trust_review_tasks WHERE status = $1 ORDER BY created_at LIMIT 100`,
    [status]
  )
  return jsonSuccess(request, { tasks })
}

export async function PATCH(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Administrator access required', 'ADMIN_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'trust-review-decision',
    key: request.headers.get('idempotency-key'),
    actorUserId: admin.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      try {
        const result = await decideFactCorrection(parsed.data.taskId, admin.id, parsed.data.decision, parsed.data.decisionReason, parsed.data.correctedValue, getRequestContext(request))
        return jsonSuccess(request, result)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'TRUST_REVIEW_FAILED'
        return jsonError(request, code.includes('NOT_FOUND') ? 404 : 500, 'Failed to resolve correction review', code)
      }
    },
  })
}

