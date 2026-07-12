import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createDisclosurePackage } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { getClientIp } from '@/lib/rate-limit'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  subjectType: z.enum(['tenant', 'landlord', 'property']),
  subjectId: z.string().uuid(),
  recipientId: z.string().uuid(),
  recipientRole: z.enum(['tenant', 'landlord', 'broker']),
  transactionId: z.string().uuid(),
  purpose: z.string().min(1).max(50),
  consentId: z.string().uuid(),
  conditions: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'trust-disclosure-decide',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      if (parsed.data.recipientId !== user.id) return jsonError(request, 403, 'Recipient identity mismatch', 'DISCLOSURE_RECIPIENT_MISMATCH')
      try {
        const context = getRequestContext(request)
        const disclosure = await createDisclosurePackage(parsed.data, user.id, { ...context, ip: getClientIp(request) })
        return jsonSuccess(request, { disclosure }, 201)
      } catch (error) {
        console.error('Disclosure decision failed:', error)
        const code = error instanceof Error ? error.message : 'DISCLOSURE_FAILED'
        return jsonError(request, code.includes('NOT_FOUND') ? 404 : code.includes('FORBIDDEN') || code.includes('MISMATCH') ? 403 : 400, 'Unable to create minimum disclosure package', code)
      }
    },
  })
}

