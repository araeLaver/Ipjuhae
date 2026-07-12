import { z } from 'zod'
import { getAdminUser } from '@/lib/admin'
import { completeExtractionJob } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  fields: z.array(z.object({
    fieldName: z.string().min(1).max(100),
    rawValue: z.unknown().optional(),
    normalizedValue: z.unknown(),
    confidence: z.number().min(0).max(1),
    pageRef: z.string().max(40).nullish(),
    reasonCodes: z.array(z.string().max(100)).max(20).optional(),
  })).min(1).max(100),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Administrator access required', 'ADMIN_REQUIRED')
  const { id } = await params
  return withIdempotency({
    request,
    namespace: 'trust-extraction-complete',
    key: request.headers.get('idempotency-key'),
    actorUserId: admin.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      try {
        return jsonSuccess(request, await completeExtractionJob(id, admin.id, parsed.data.fields, getRequestContext(request)))
      } catch (error) {
        const code = error instanceof Error ? error.message : 'TRUST_EXTRACTION_COMPLETE_FAILED'
        return jsonError(request, code.includes('NOT_FOUND') ? 404 : code.includes('ALREADY') ? 409 : 500, 'Failed to finalize extraction', code)
      }
    },
  })
}

