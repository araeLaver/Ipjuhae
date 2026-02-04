import { NextResponse } from 'next/server'
import { query, queryOne, transaction } from '@/lib/db'
import { LandlordReference, Profile, ReferenceResponse } from '@/types/database'
import { referenceSurveySchema } from '@/lib/validations'
import { apiRateLimit, getClientIp } from '@/lib/rate-limit'
import { sanitizeUserInput } from '@/lib/sanitize'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET: 토큰 유효성 확인
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request)
    const rl = apiRateLimit(ip)
    if (!rl.success) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

    const { token } = await params

    const reference = await queryOne<LandlordReference & { tenant_name?: string }>(
      `SELECT lr.*, p.name as tenant_name
       FROM landlord_references lr
       LEFT JOIN profiles p ON lr.user_id = p.user_id
       WHERE lr.verification_token = $1`,
      [token]
    )

    if (!reference) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다' }, { status: 404 })
    }

    if (reference.token_expires_at && new Date(reference.token_expires_at) < new Date()) {
      return NextResponse.json({ error: '링크가 만료되었습니다' }, { status: 400 })
    }

    if (reference.status === 'completed') {
      return NextResponse.json({ error: '이미 설문이 완료되었습니다' }, { status: 400 })
    }

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
    const ip = getClientIp(request)
    const rl = apiRateLimit(ip)
    if (!rl.success) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

    const { token } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE verification_token = $1',
      [token]
    )

    if (!reference) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다' }, { status: 404 })
    }

    if (reference.token_expires_at && new Date(reference.token_expires_at) < new Date()) {
      return NextResponse.json({ error: '링크가 만료되었습니다' }, { status: 400 })
    }

    if (reference.status === 'completed') {
      return NextResponse.json({ error: '이미 설문이 완료되었습니다' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = referenceSurveySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다' },
        { status: 400 }
      )
    }

    const { rentPayment, propertyCondition, neighborIssues, checkoutCondition, wouldRecommend, comment } = parsed.data

    // XSS 방지를 위한 comment sanitization
    const sanitizedComment = comment ? sanitizeUserInput(comment) : null

    const avgScore = (rentPayment + propertyCondition + neighborIssues + checkoutCondition) / 4
    let overallRating = 'neutral'
    if (avgScore >= 4) overallRating = 'positive'
    else if (avgScore < 2.5) overallRating = 'negative'

    // 트랜잭션으로 응답 저장 + 상태 업데이트를 원자적으로 처리
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO reference_responses
          (reference_id, rent_payment, property_condition, neighbor_issues, checkout_condition, would_recommend, comment, overall_rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [reference.id, rentPayment, propertyCondition, neighborIssues, checkoutCondition, wouldRecommend, sanitizedComment, overallRating]
      )
      await client.query(
        `UPDATE landlord_references SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [reference.id]
      )
    })

    return NextResponse.json({
      message: '설문이 완료되었습니다. 감사합니다!',
    })
  } catch (error) {
    console.error('Submit survey error:', error)
    return NextResponse.json({ error: '설문 제출 중 오류가 발생했습니다' }, { status: 500 })
  }
}
