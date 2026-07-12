import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { revokeDisclosurePackage } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({ reason: z.string().min(3).max(500) })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params
  const disclosure = await queryOne<Record<string, unknown>>(
    `SELECT package.* FROM trust_disclosure_packages package
      JOIN data_consents consent ON consent.id = package.consent_id
      WHERE package.id = $1 AND ($2 = package.recipient_id OR $2 = consent.user_id)`,
    [id, user.id]
  )
  if (!disclosure) return jsonError(request, 404, 'Disclosure package not found', 'DISCLOSURE_NOT_FOUND')
  return jsonSuccess(request, { disclosure })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params
  return withIdempotency({
    request,
    namespace: 'trust-disclosure-revoke',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      try {
        return jsonSuccess(request, await revokeDisclosurePackage(id, user.id, parsed.data.reason, getRequestContext(request)))
      } catch (error) {
        const code = error instanceof Error ? error.message : 'DISCLOSURE_REVOKE_FAILED'
        return jsonError(request, code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : 500, 'Failed to revoke disclosure package', code)
      }
    },
  })
}

