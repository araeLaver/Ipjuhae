import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const createReviewSchema = z.object({
  revieweeId: z.string().uuid('유효하지 않은 사용자 ID입니다'),
  listingId: z.number().int().optional(),
  rating: z.number().int().min(1).max(5, '별점은 1-5점이어야 합니다'),
  comment: z.string().max(200, '한줄평은 200자 이하로 입력해주세요').optional(),
})

// POST: 리뷰 작성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createReviewSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값을 확인해주세요' },
        { status: 400 }
      )
    }

    const { revieweeId, listingId, rating, comment } = parsed.data

    if (revieweeId === user.id) {
      return NextResponse.json({ error: '자신을 평가할 수 없습니다' }, { status: 400 })
    }

    // 대상 사용자 존재 확인
    const reviewee = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [revieweeId]
    )
    if (!reviewee) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
    }

    // 중복 확인
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM reviews WHERE reviewer_id = $1 AND reviewee_id = $2 AND ($3::int IS NULL OR listing_id = $3)',
      [user.id, revieweeId, listingId ?? null]
    )
    if (existing) {
      return NextResponse.json({ error: '이미 리뷰를 작성하셨습니다' }, { status: 409 })
    }

    const [review] = await query<{ id: string }>(
      `INSERT INTO reviews (reviewer_id, reviewee_id, listing_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, revieweeId, listingId ?? null, rating, comment ?? null]
    )

    logger.info('리뷰 작성', { reviewerId: user.id, revieweeId, rating })

    return NextResponse.json({ message: '리뷰가 등록되었습니다', id: review.id }, { status: 201 })
  } catch (error) {
    logger.error('리뷰 작성 오류', { error })
    return NextResponse.json({ error: '리뷰 작성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
