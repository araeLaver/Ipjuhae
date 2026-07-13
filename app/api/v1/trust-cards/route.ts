import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createTrustCard, listTrustCards } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  reportId: z.string().uuid(),
  subjectType: z.enum(['tenant', 'landlord', 'property', 'broker', 'combined']),
  subjectId: z.string().uuid().nullish(),
  title: z.string().trim().min(2).max(160),
  audienceRole: z.enum(['tenant', 'landlord', 'broker', 'institution', 'private_recipient']),
  purpose: z.string().trim().min(2).max(300),
  fieldKeys: z.array(z.string().min(1).max(100)).min(1).max(40),
  expiresAt: z.string().datetime(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return jsonSuccess(request, { cards: await listTrustCards(user.id) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'trust-card-create',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) {
        return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      }
      try {
        return jsonSuccess(request, await createTrustCard(user.id, parsed.data), 201)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'TRUST_CARD_CREATE_FAILED'
        const status = code.includes('NOT_READY') || code.includes('NOT_APPROVED') ? 409 : code.endsWith('NOT_FOUND') ? 404 : 500
        return jsonError(request, status, 'Failed to create Trust Card', code)
      }
    },
  })
}

