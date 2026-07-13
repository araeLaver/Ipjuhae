import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createOrganization, listOrganizations } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  organizationType: z.enum(['broker_office', 'property_manager', 'institution', 'proptech', 'other']),
  businessNumber: z.string().trim().max(40).nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return jsonSuccess(request, { organizations: await listOrganizations(user.id) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'trust-organization-create',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, 'Invalid organization payload', 'INVALID_PAYLOAD')
      const organization = await createOrganization(user.id, parsed.data)
      return jsonSuccess(request, { organization }, 201)
    },
  })
}

