import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

interface ReviewRow {
  id: string
  reviewer_id: string
  reviewer_name: string
  rating: number
  comment: string | null
  created_at: string
}

interface AverageRow {
  avg_rating: string | null
  total_count: string
}

// GET: 특정 유저의 리뷰 목록 + 평균 점수
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)
    const offset = (page - 1) * limit

    const reviews = await query<ReviewRow>(
      `SELECT
        r.id,
        r.reviewer_id,
        u.name AS reviewer_name,
        r.rating,
        r.comment,
        r.created_at::text
      FROM reviews r
      JOIN users u ON u.id = r.reviewer_id
      WHERE r.reviewee_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    const avg = await queryOne<AverageRow>(
      'SELECT AVG(rating)::numeric(3,1) AS avg_rating, COUNT(*) AS total_count FROM reviews WHERE reviewee_id = $1',
      [userId]
    )

    return NextResponse.json({
      reviews,
      summary: {
        avgRating: avg?.avg_rating ? parseFloat(avg.avg_rating) : null,
        totalCount: parseInt(avg?.total_count || '0', 10),
      },
      pagination: {
        page,
        limit,
        offset,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: '리뷰 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
