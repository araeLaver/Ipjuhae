import { getAdminUser } from '@/lib/admin'
import { query } from '@/lib/db'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function GET(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return jsonError(request, 403, 'Administrator access required', 'ADMIN_REQUIRED')
  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? 'review_required'
  const jobs = await query(
    `SELECT job.id, job.owner_user_id, users.email, users.name, job.subject_type, job.subject_id,
            job.document_type, job.engine_version, job.status, job.attempt, job.error_code,
            job.created_at, job.completed_at
       FROM trust_extraction_jobs job
       JOIN users ON users.id = job.owner_user_id
      WHERE job.status = $1
      ORDER BY job.created_at LIMIT 100`,
    [status]
  )
  return jsonSuccess(request, { jobs })
}

