import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { listDocumentIntakes, registerDocumentIntake } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  subjectType: z.enum(['tenant', 'landlord', 'property']),
  subjectId: z.string().uuid(),
  originalFilename: z.string().trim().min(1).max(255),
  mediaType: z.string().trim().min(3).max(150),
  byteSize: z.number().int().positive().max(30 * 1024 * 1024),
  fileSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  storageRef: z.string().trim().min(1).max(1000),
  sourceKind: z.enum(['user_upload', 'public_record', 'partner_api', 'operator_upload']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return jsonSuccess(request, { intakes: await listDocumentIntakes(user.id) })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'document-intake-register',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) {
        return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      }
      if (parsed.data.subjectType !== 'property' && parsed.data.subjectId !== user.id && user.user_type !== 'admin') {
        return jsonError(request, 403, 'Document subject access denied', 'DOCUMENT_SUBJECT_FORBIDDEN')
      }
      const intake = await registerDocumentIntake(user.id, parsed.data)
      return jsonSuccess(request, { intake, next_action: 'security_scan' }, 202)
    },
  })
}

