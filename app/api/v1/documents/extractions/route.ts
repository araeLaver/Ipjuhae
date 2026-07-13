import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { createExtractionJob } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { withIdempotency } from '@/lib/idempotency'

const schema = z.object({
  intakeId: z.string().uuid(),
  documentId: z.string().uuid().nullish(),
  subjectType: z.enum(['tenant', 'landlord', 'property']),
  subjectId: z.string().uuid(),
  propertyId: z.string().uuid().nullish(),
  sourceCode: z.string().min(1).max(80).default('user_upload'),
  consentId: z.string().uuid().nullish(),
  storageRef: z.string().min(1).max(1000),
  inputChecksum: z.string().length(64),
  documentType: z.string().min(1).max(80),
  engineVersion: z.string().max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const jobs = await query(`SELECT id, subject_type, subject_id, document_type, engine_version, status, attempt, error_code, started_at, completed_at, created_at FROM trust_extraction_jobs WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 100`, [user.id])
  return jsonSuccess(request, { jobs })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  return withIdempotency({
    request,
    namespace: 'trust-extraction-create',
    key: request.headers.get('idempotency-key'),
    actorUserId: user.id,
    handler: async () => {
      const parsed = schema.safeParse(await request.json())
      if (!parsed.success) return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
      if (parsed.data.subjectType !== 'property' && parsed.data.subjectId !== user.id && user.user_type !== 'admin') return jsonError(request, 403, 'Extraction subject access denied', 'TRUST_EXTRACTION_FORBIDDEN')
      const intake = await queryOne<{ file_sha256: string; storage_ref: string; scan_status: string }>(
        'SELECT file_sha256, storage_ref, scan_status FROM document_intakes WHERE id = $1 AND owner_user_id = $2',
        [parsed.data.intakeId, user.id]
      )
      if (!intake) return jsonError(request, 404, 'Document intake not found', 'DOCUMENT_INTAKE_NOT_FOUND')
      if (intake.scan_status !== 'clean') return jsonError(request, 423, 'Document security scan is not complete', 'DOCUMENT_SCAN_REQUIRED')
      if (intake.file_sha256 !== parsed.data.inputChecksum.toLowerCase() || intake.storage_ref !== parsed.data.storageRef) {
        return jsonError(request, 409, 'Document intake metadata mismatch', 'DOCUMENT_INTAKE_MISMATCH')
      }
      try {
        const job = await createExtractionJob(parsed.data, user.id, getRequestContext(request))
        await query('UPDATE document_intakes SET extraction_job_id = $2, updated_at = NOW() WHERE id = $1', [
          parsed.data.intakeId,
          job.id,
        ])
        return jsonSuccess(request, { job }, 202)
      } catch (error) {
        const code = error instanceof Error ? error.message : 'TRUST_EXTRACTION_FAILED'
        return jsonError(request, 500, 'Failed to create extraction job', code)
      }
    },
  })
}
