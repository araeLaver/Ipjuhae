import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { LandlordReference, ReferenceResponse, ReferenceResponseItem, ReferenceDispute } from '@/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: 레퍼런스 상세
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE id = $1 AND COALESCE(subject_user_id, user_id) = $2',
      [id, user.id]
    )

    if (!reference) {
      return NextResponse.json({ error: '레퍼런스를 찾을 수 없습니다' }, { status: 404 })
    }

    // 응답 및 항목형 응답도 함께 조회
    const response = await queryOne<ReferenceResponse>(
      'SELECT * FROM reference_responses WHERE reference_id = $1',
      [id]
    )

    const responseItems = response
      ? await query<ReferenceResponseItem>(
          'SELECT * FROM reference_response_items WHERE response_id = $1 ORDER BY item_code',
          [response.id],
        )
      : []

    const disputes = response
      ? await query<ReferenceDispute & { item_code: string | null }>(
          `SELECT rd.*, rri.item_code
           FROM reference_disputes rd
           LEFT JOIN reference_response_items rri
             ON rd.response_item_id = rri.id
           WHERE rd.response_id = $1
           ORDER BY rd.created_at DESC`,
          [response.id],
        )
      : []

    return NextResponse.json({ reference, response, responseItems, disputes })
  } catch (error) {
    console.error('Get reference error:', error)
    return NextResponse.json({ error: '레퍼런스 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// DELETE: 레퍼런스 요청 취소
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE id = $1 AND COALESCE(subject_user_id, user_id) = $2',
      [id, user.id]
    )

    if (!reference) {
      return NextResponse.json({ error: '레퍼런스를 찾을 수 없습니다' }, { status: 404 })
    }

    if (reference.status === 'completed') {
      return NextResponse.json({ error: '이미 완료된 레퍼런스는 취소할 수 없습니다' }, { status: 400 })
    }

    await query(
      'DELETE FROM landlord_references WHERE id = $1',
      [id]
    )

    return NextResponse.json({ message: '레퍼런스 요청이 취소되었습니다' })
  } catch (error) {
    console.error('Delete reference error:', error)
    return NextResponse.json({ error: '레퍼런스 취소 중 오류가 발생했습니다' }, { status: 500 })
  }
}
