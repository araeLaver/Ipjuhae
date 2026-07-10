import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { referenceDisputeSchema, type ReferenceDisputeInput } from '@/lib/validations'
import { LandlordReference, ReferenceDispute, ReferenceResponse } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

function resolveSqlErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback
  }

  return error.message.includes('duplicate key') ? '이미 동일 유형의 요청이 접수되어 있습니다' : fallback
}

async function requireReferenceOwnership(referenceId: string, viewerId: string): Promise<boolean> {
  const reference = await queryOne<LandlordReference>(
    `SELECT id
       FROM landlord_references
      WHERE id = $1 AND COALESCE(subject_user_id, user_id) = $2`,
    [referenceId, viewerId],
  )

  return Boolean(reference)
}

// GET: 레퍼런스 분쟁/정정 목록
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params

    const hasAccess = await requireReferenceOwnership(id, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: '레퍼런스를 찾을 수 없습니다' }, { status: 404 })
    }

    const disputes = await query<ReferenceDispute & { item_code: string | null }>(
      `SELECT rd.*, rri.item_code
       FROM reference_disputes rd
       JOIN reference_responses rr
         ON rd.response_id = rr.id
       LEFT JOIN reference_response_items rri
         ON rd.response_item_id = rri.id
       WHERE rr.reference_id = $1
       ORDER BY rd.created_at DESC`,
      [id],
    )

    return NextResponse.json({ disputes })
  } catch (error) {
    console.error('Get reference disputes error:', error)
    return NextResponse.json({ error: '분쟁 요청 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
// POST: 레퍼런스 분쟁/정정 등록
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params

    const hasAccess = await requireReferenceOwnership(id, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: '레퍼런스를 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: '요청 본문이 필요합니다' }, { status: 400 })
    }

    const parsed = referenceDisputeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다' },
        { status: 400 },
      )
    }

    const payload = parsed.data as ReferenceDisputeInput

    const response = await queryOne<ReferenceResponse>(
      'SELECT id FROM reference_responses WHERE id = $1 AND reference_id = $2',
      [payload.responseId, id],
    )

    if (!response) {
      return NextResponse.json({ error: '레퍼런스 응답을 찾을 수 없습니다' }, { status: 400 })
    }

    if (payload.responseItemId) {
      const item = await queryOne<{ id: string }>(
        'SELECT id FROM reference_response_items WHERE id = $1 AND response_id = $2',
        [payload.responseItemId, payload.responseId],
      )

      if (!item) {
        return NextResponse.json(
          { error: '해당 레퍼런스 항목을 찾을 수 없습니다' },
          { status: 400 },
        )
      }
    }

    const [dispute] = await query<ReferenceDispute>(
      `INSERT INTO reference_disputes
          (response_id, response_item_id, requester_user_id, request_type, request_reason, requested_value, request_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (response_id, requester_user_id, request_type)
       DO UPDATE SET
         request_reason = EXCLUDED.request_reason,
         requested_value = EXCLUDED.requested_value,
         request_status = 'pending',
         resolution_note = NULL,
         resolved_at = NULL,
         resolved_by = NULL,
         updated_at = NOW()
       RETURNING *`,
      [
        payload.responseId,
        payload.responseItemId || null,
        user.id,
        payload.requestType,
        payload.requestReason,
        payload.requestedValue ?? null,
      ],
    )

    if (!dispute) {
      return NextResponse.json({ error: '분쟁 요청 생성에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ dispute }, { status: 201 })
  } catch (error) {
    const message = resolveSqlErrorMessage(error, '분쟁 요청 등록 중 오류가 발생했습니다')
    console.error('Create reference dispute error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
