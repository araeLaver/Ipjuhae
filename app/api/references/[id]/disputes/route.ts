import { z } from 'zod'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { LandlordReference, ReferenceDispute, ReferenceResponse } from '@/types/database'
import { jsonError, jsonSuccess } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

const disputeCreateSchema = z.object({
  reason: z.string().trim().min(2).max(120),
  detail: z.string().trim().min(5).max(1200),
})

const disputeReviewSchema = z.object({
  status: z.enum(['reviewing', 'accepted', 'rejected', 'corrected', 'withheld', 'completed', 'deleted']),
  reviewComment: z.string().trim().max(1200).optional(),
  disputeId: z.string().uuid().optional(),
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

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return jsonError(_request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  try {
    const { id } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE id = $1',
      [id]
    )

    if (!reference) {
      return jsonError(_request, 404, 'Reference request not found', 'REFERENCE_NOT_FOUND')
    }

    if (reference.user_id !== user.id) {
      return jsonError(_request, 403, 'Access forbidden', 'FORBIDDEN')
    }

    const response = await queryOne<ReferenceResponse>(
      'SELECT * FROM reference_responses WHERE reference_id = $1',
      [id]
    )

    if (!response) {
      return jsonSuccess(_request, { disputes: [] })
    }

    const disputes = await query<ReferenceDispute>(
      'SELECT * FROM reference_disputes WHERE reference_response_id = $1 ORDER BY created_at DESC',
      [response.id]
    )

    return jsonSuccess(_request, { disputes })
  } catch (error) {
    console.error('Get disputes error:', error)
    return jsonError(_request, 500, 'Failed to list disputes', 'REFERENCE_DISPUTE_LIST_FAILED')
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = disputeCreateSchema.safeParse(body)

    if (!parsed.success) {
      return jsonError(request, 400, parsed.error.issues[0]?.message || 'Invalid request payload', 'INVALID_PAYLOAD')
    }

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE id = $1',
      [id]
    )

    if (!reference) {
      return jsonError(request, 404, 'Reference request not found', 'REFERENCE_NOT_FOUND')
    }

    if (reference.user_id !== user.id) {
      return jsonError(request, 403, 'Access forbidden', 'FORBIDDEN')
    }

    const response = await queryOne<ReferenceResponse>(
      'SELECT * FROM reference_responses WHERE reference_id = $1',
      [id]
    )

    if (!response) {
      return jsonError(request, 400, 'No completed response found', 'REFERENCE_RESPONSE_NOT_FOUND')
    }

    const existing = await queryOne<ReferenceDispute>(
      `SELECT *
       FROM reference_disputes
       WHERE reference_response_id = $1
         AND requester_user_id = $2
         AND status IN ('pending', 'reviewing')`,
      [response.id, user.id]
    )

    if (existing) {
      return jsonError(request, 409, 'A dispute is already open', 'DUPLICATE_DISPUTE')
    }

    const [dispute] = await query<ReferenceDispute>(
      `INSERT INTO reference_disputes
       (reference_response_id, reason, detail, requester_user_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [response.id, parsed.data.reason, parsed.data.detail, user.id]
    )

    return jsonSuccess(request, { dispute }, 201)
  } catch (error) {
    console.error('Create dispute error:', error)
    return jsonError(request, 500, 'Failed to create dispute', 'REFERENCE_DISPUTE_CREATE_FAILED')
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  if (user.user_type !== 'admin') {
    return jsonError(request, 403, 'Admin only', 'FORBIDDEN')
  }

  try {
    const body = await request.json()
    const parsed = disputeReviewSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(request, 400, parsed.error.issues[0]?.message || 'Invalid request payload', 'INVALID_PAYLOAD')
    }

    const { id } = await params
    const { status, reviewComment, disputeId } = parsed.data

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE id = $1',
      [id]
    )

    if (!reference) {
      return jsonError(request, 404, 'Reference request not found', 'REFERENCE_NOT_FOUND')
    }

    const response = await queryOne<ReferenceResponse>(
      'SELECT * FROM reference_responses WHERE reference_id = $1',
      [id]
    )

    if (!response) {
      return jsonError(request, 400, 'No response found for review', 'REFERENCE_RESPONSE_NOT_FOUND')
    }

    const disputes = disputeId
      ? await query<ReferenceDispute>(
          `SELECT *
             FROM reference_disputes
            WHERE id = $1
              AND reference_response_id = $2`,
          [disputeId, response.id]
        )
      : await query<ReferenceDispute>(
          `SELECT *
             FROM reference_disputes
            WHERE reference_response_id = $1
              AND status IN ('pending', 'reviewing')
            ORDER BY created_at DESC
            LIMIT 1`,
          [response.id]
        )

    const current = disputes[0]
    if (!current) {
      return jsonError(request, 404, 'No active dispute found', 'REFERENCE_DISPUTE_NOT_FOUND')
    }

    if (current.status !== status && !STATUS_TRANSITIONS[current.status]?.includes(status)) {
      return jsonError(
        request,
        409,
        `Invalid transition ${current.status} -> ${status}`,
        'INVALID_DISPUTE_TRANSITION'
      )
    }

    if (current.status === status) {
      return jsonSuccess(request, {
        dispute: current,
        message: 'No changes applied because status is unchanged',
      })
    }

    const [updated] = await query<ReferenceDispute>(
      `UPDATE reference_disputes
       SET status = $1,
           review_comment = $2,
           reviewed_by = $3,
           reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, reviewComment ?? null, user.id, current.id]
    )

    if (!updated) {
      return jsonError(request, 404, 'Failed to update dispute', 'REFERENCE_DISPUTE_UPDATE_FAILED')
    }

    return jsonSuccess(request, {
      dispute: updated,
      message: 'Dispute status updated',
    })
  } catch (error) {
    console.error('Update dispute error:', error)
    return jsonError(request, 500, 'Failed to update dispute', 'REFERENCE_DISPUTE_UPDATE_FAILED')
  }
}
