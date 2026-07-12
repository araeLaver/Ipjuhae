import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { submitBilateralReference } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  answers: z.record(z.string(), z.unknown()),
  rating: z.number().min(0).max(100),
  comment: z.string().max(2000).nullish(),
  sharedIdentifier: z.string().max(500).nullish(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params
  const rows = await query(
    `SELECT rs.id, rs.responder_id, rs.subject_id, rs.responder_role, rs.reveal_state,
            CASE WHEN rs.responder_id = $2 OR rs.reveal_state = 'PUBLISHED' THEN rs.structured_answers ELSE NULL END AS structured_answers,
            CASE WHEN rs.responder_id = $2 OR rs.reveal_state = 'PUBLISHED' THEN rs.rating ELSE NULL END AS rating,
            rs.submitted_at, rs.reveal_after, rs.revealed_at
       FROM trust_reference_submissions rs
       JOIN trust_tenancy_relationships rel ON rel.id = rs.relationship_id
      WHERE rel.transaction_id = $1 AND ($2 = rel.landlord_id OR $2 = rel.tenant_id)
      ORDER BY rs.submitted_at`,
    [id, user.id]
  )
  return jsonSuccess(request, { submissions: rows })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params
  return withIdempotency({
    request,
    namespace: 'trust-bilateral-reference',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      try {
        const result = await submitBilateralReference(id, user.id, parsed.data.answers, parsed.data.rating, parsed.data.comment ?? null, parsed.data.sharedIdentifier ?? null, getRequestContext(request))
        return jsonSuccess(request, result, 201)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'TRUST_REFERENCE_FAILED'
        return jsonError(request, code.includes('FORBIDDEN') ? 403 : code.includes('NOT_VERIFIED') ? 409 : 500, 'Failed to submit bilateral reference', code)
      }
    },
  })
}

