import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { signPinnedTransactionAtomically } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  conditionHash: z.string().length(64),
  evidenceSetHash: z.string().length(64),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params

  return withIdempotency({
    request,
    namespace: 'trust-transaction-atomic-sign',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) {
        return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      }
      try {
        const result = await signPinnedTransactionAtomically(
          id,
          user.id,
          parsed.data,
          getRequestContext(request)
        )
        return jsonSuccess(request, result, result.signed ? 200 : 409)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'TRUST_SIGN_FAILED'
        const status =
          code.includes('FORBIDDEN') ? 403 :
            code.includes('NOT_FOUND') ? 404 :
              code.includes('NOT_PINNED') ? 409 : 500
        return jsonError(request, status, 'Failed to sign transaction', code)
      }
    },
  })
}
