import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { LandlordReference, ReferenceDispute, ReferenceResponse } from '@/types/database'
import { jsonError, jsonSuccess } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
    }

    const { id } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE id = $1 AND user_id = $2',
      [id, user.id]
    )

    if (!reference) {
      return jsonError(request, 404, 'Reference request not found', 'REFERENCE_NOT_FOUND')
    }

    const response = await queryOne<ReferenceResponse>(
      'SELECT * FROM reference_responses WHERE reference_id = $1',
      [id]
    )

    const disputes = response
      ? await query<ReferenceDispute>(
          'SELECT * FROM reference_disputes WHERE reference_response_id = $1 ORDER BY created_at DESC',
          [response.id]
        )
      : []

    return jsonSuccess(request, {
      reference,
      response,
      disputes,
    })
  } catch (error) {
    console.error('Get reference error:', error)
    return jsonError(request, 500, 'Failed to load reference detail', 'REFERENCE_DETAIL_FAILED')
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  try {
    const { id } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE id = $1 AND user_id = $2',
      [id, user.id]
    )

    if (!reference) {
      return jsonError(request, 404, 'Reference request not found', 'REFERENCE_NOT_FOUND')
    }

    if (reference.status === 'completed') {
      return jsonError(request, 400, 'Cannot delete a completed reference request', 'REFERENCE_ALREADY_COMPLETED')
    }

    await query('DELETE FROM landlord_references WHERE id = $1', [id])

    return jsonSuccess(request, {
      message: 'Reference request deleted',
    })
  } catch (error) {
    console.error('Delete reference error:', error)
    return jsonError(request, 500, 'Failed to delete reference', 'REFERENCE_DELETE_FAILED')
  }
}
