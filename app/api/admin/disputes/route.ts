import { z } from 'zod'
import { NextRequest } from 'next/server'
import { getAdminUser, logAdminAction } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'
import { ReferenceDispute } from '@/types/database'
import { jsonError, jsonSuccess } from '@/lib/api-response'

const STATUS_VALUES = ['pending', 'reviewing', 'accepted', 'rejected', 'corrected', 'withheld', 'completed', 'deleted'] as const

interface DisputeRow extends ReferenceDispute {
  landlord_reference_id: string
  tenant_user_id: string | null
  landlord_name: string | null
  tenant_name: string | null
  requester_email: string | null
  reviewed_by_name: string | null
}

const listSchema = z.object({
  status: z
    .enum(['all', ...STATUS_VALUES] as [string, ...string[]])
    .default('all')
    .transform((value) => value as 'all' | ReferenceDispute['status']),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const reviewSchema = z.object({
  disputeId: z.string().uuid(),
  status: z.enum(STATUS_VALUES),
  reviewComment: z.string().trim().max(1200).optional(),
})

const STATUS_TRANSITIONS: Record<ReferenceDispute['status'], Array<ReferenceDispute['status']>> = {
  pending: ['reviewing', 'accepted', 'rejected', 'corrected', 'withheld', 'completed', 'deleted'],
  reviewing: ['accepted', 'rejected', 'corrected', 'withheld', 'completed', 'deleted'],
  accepted: ['completed'],
  rejected: ['reviewing', 'completed'],
  corrected: ['completed'],
  withheld: ['completed'],
  completed: [],
  deleted: [],
}

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return jsonError(req, 403, 'Forbidden', 'FORBIDDEN')
  }

  const queryParse = listSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()))
  if (!queryParse.success) {
    return jsonError(req, 400, queryParse.error.issues[0]?.message || 'Invalid query params', 'INVALID_QUERY')
  }

  const { status, limit, offset } = queryParse.data
  const statusFilter = status === 'all' ? '' : 'AND rd.status = $1'
  const params: Array<string | number> = status === 'all' ? [] : [status]
  const where = `WHERE 1=1 ${statusFilter}`

  const disputes = await query<DisputeRow>(
    `SELECT
       rd.id,
       rd.reference_response_id,
       rd.reason,
       rd.detail,
       rd.status,
       rd.requester_user_id,
       u.email AS requester_email,
       rd.reviewed_by,
       rb.name AS reviewed_by_name,
       rd.reviewed_at,
       rd.review_comment,
       rd.created_at,
       rd.updated_at,
       lr.id AS landlord_reference_id,
       lr.user_id AS tenant_user_id,
       lr.landlord_name,
       p.name AS tenant_name
     FROM reference_disputes rd
     JOIN reference_responses rr ON rr.id = rd.reference_response_id
     JOIN landlord_references lr ON lr.id = rr.reference_id
     LEFT JOIN users u ON u.id = rd.requester_user_id
     LEFT JOIN users rb ON rb.id = rd.reviewed_by
     LEFT JOIN profiles p ON p.user_id = lr.user_id
     ${where}
     ORDER BY rd.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  )

  const totalRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM reference_disputes rd
       ${where}`,
    params
  )
  const total = Number.parseInt(totalRows?.[0]?.count ?? '0', 10)

  const [pendingCountRow] = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM reference_disputes WHERE status IN ('pending', 'reviewing')`,
    []
  )

  return jsonSuccess(req, {
    disputes,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + disputes.length < total,
    },
    pendingCount: Number.parseInt(pendingCountRow.count ?? '0', 10),
  })
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return jsonError(req, 403, 'Forbidden', 'FORBIDDEN')
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return jsonError(req, 400, 'Invalid request body', 'INVALID_BODY')
  }

  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(req, 400, parsed.error.issues[0]?.message || 'Invalid request body', 'INVALID_BODY')
  }

  const { disputeId, status, reviewComment } = parsed.data

  const current = await queryOne<ReferenceDispute>('SELECT * FROM reference_disputes WHERE id = $1', [disputeId])
  if (!current) {
    return jsonError(req, 404, 'Dispute not found', 'DISPUTE_NOT_FOUND')
  }

  const nextAllowed = STATUS_TRANSITIONS[current.status] ?? []
  if (current.status !== status && !nextAllowed.includes(status)) {
    return jsonError(
      req,
      409,
      `Invalid status transition. ${current.status} -> ${status}`,
      'INVALID_STATUS_TRANSITION'
    )
  }

  const [updated] = await query<ReferenceDispute>(
    `UPDATE reference_disputes
       SET status = $1,
           review_comment = $2,
           reviewed_by = $3,
           reviewed_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, reviewComment ?? null, admin.id, disputeId]
  )

  await logAdminAction(
    admin.id,
    'dispute_review',
    'profile',
    disputeId,
    { previousStatus: current.status, nextStatus: status }
  )

  if (!updated) {
    return jsonError(req, 500, 'Failed to update dispute', 'DISPUTE_UPDATE_FAILED')
  }

  return jsonSuccess(req, { dispute: updated })
}
