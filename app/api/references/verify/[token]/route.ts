import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { LandlordReference, Profile, ReferenceResponse } from '@/types/database'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET: 토큰 유효성 확인
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params

    const reference = await queryOne<LandlordReference>(
      `SELECT lr.*, p.name as tenant_name
       FROM landlord_references lr
       LEFT JOIN profiles p ON lr.user_id = p.user_id
       WHERE lr.verification_token = $1`,
      [token]
    )

    if (!reference) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다' }, { status: 404 })
    }

    // 만료 확인
    if (reference.token_expires_at && new Date(reference.token_expires_at) < new Date()) {
      return NextResponse.json({ error: '링크가 만료되었습니다' }, { status: 400 })
    }

    // 이미 완료됨
    if (reference.status === 'completed') {
      return NextResponse.json({ error: '이미 설문이 완료되었습니다' }, { status: 400 })
    }

    // 세입자 프로필 조회
    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [reference.user_id]
    )

    return NextResponse.json({
      valid: true,
      tenantName: profile?.name || '세입자',
      referenceId: reference.id,
    })
  } catch (error) {
    console.error('Verify token error:', error)
    return NextResponse.json({ error: '토큰 확인 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST: 설문 응답 제출
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { token } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE verification_token = $1',
      [token]
    )

    if (!reference) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다' }, { status: 404 })
    }

    // 만료 확인
    if (reference.token_expires_at && new Date(reference.token_expires_at) < new Date()) {
      return NextResponse.json({ error: '링크가 만료되었습니다' }, { status: 400 })
    }

    // 이미 완료됨
    if (reference.status === 'completed') {
      return NextResponse.json({ error: '이미 설문이 완료되었습니다' }, { status: 400 })
    }

    const {
      rentPayment,
      propertyCondition,
      neighborIssues,
      checkoutCondition,
      wouldRecommend,
      comment,
    } = await request.json()

    // 유효성 검사
    const scores = [rentPayment, propertyCondition, neighborIssues, checkoutCondition]
    for (const score of scores) {
      if (typeof score !== 'number' || score < 1 || score > 5) {
        return NextResponse.json({ error: '모든 항목에 1-5점으로 평가해주세요' }, { status: 400 })
      }
    }

    if (typeof wouldRecommend !== 'boolean') {
      return NextResponse.json({ error: '추천 여부를 선택해주세요' }, { status: 400 })
    }

    // 전체 평균 계산
    const avgScore = (rentPayment + propertyCondition + neighborIssues + checkoutCondition) / 4
    let overallRating = 'neutral'
    if (avgScore >= 4) overallRating = 'positive'
    else if (avgScore < 2.5) overallRating = 'negative'

    // 설문 응답 저장
    await query<ReferenceResponse>(
      `INSERT INTO reference_responses
        (reference_id, rent_payment, property_condition, neighbor_issues, checkout_condition, would_recommend, comment, overall_rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [reference.id, rentPayment, propertyCondition, neighborIssues, checkoutCondition, wouldRecommend, comment, overallRating]
    )

    // 레퍼런스 상태 업데이트
    await query(
      `UPDATE landlord_references SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [reference.id]
    )

    return NextResponse.json({
      message: '설문이 완료되었습니다. 감사합니다!',
    })
  } catch (error) {
    console.error('Submit survey error:', error)
    return NextResponse.json({ error: '설문 제출 중 오류가 발생했습니다' }, { status: 500 })
  }
}
