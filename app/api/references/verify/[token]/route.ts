import { NextResponse } from 'next/server'
import { query, queryOne, transaction } from '@/lib/db'
import { LandlordReference, Profile, ReferenceResponse } from '@/types/database'
import { referenceSurveySchema } from '@/lib/validations'
import { apiRateLimit, getClientIp } from '@/lib/rate-limit'
import { sanitizeUserInput } from '@/lib/sanitize'
import { notifyReferenceCompleted } from '@/lib/notifications'

interface RouteParams {
  params: Promise<{ token: string }>
}

function calcRating(avg: number): string {
  if (avg >= 4) return 'positive'
  if (avg < 2.5) return 'negative'
  return 'neutral'
}

// GET: 토큰 유효성 확인 (completed이면 기존 응답 함께 반환)
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

    // 만료 — expired status이거나 token_expires_at 지난 경우 (단, completed는 수정 허용이므로 만료 체크 스킵)
    if (
      reference.status !== 'completed' &&
      reference.token_expires_at &&
      new Date(reference.token_expires_at) < new Date()
    ) {
      return NextResponse.json({ error: '링크가 만료되었습니다' }, { status: 400 })
    }

    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [reference.user_id]
    )

    // 이미 완료된 경우 — 기존 응답 데이터도 함께 반환 (수정 UI에서 pre-fill)
    if (reference.status === 'completed') {
      const existingResponse = await queryOne<ReferenceResponse>(
        'SELECT * FROM reference_responses WHERE reference_id = $1',
        [reference.id]
      )
      return NextResponse.json({
        valid: true,
        completed: true,
        editable: true,
        tenantName: profile?.name || '세입자',
        referenceId: reference.id,
        existingResponse: existingResponse ?? null,
      })
    }

    return NextResponse.json({
      valid: true,
      completed: false,
      editable: false,
      tenantName: profile?.name || '세입자',
      referenceId: reference.id,
    })
  } catch (error) {
    console.error('Verify token error:', error)
    return NextResponse.json({ error: '토큰 확인 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST: 최초 설문 응답 제출
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
      return NextResponse.json({ error: '이미 제출되었습니다. 수정하려면 PATCH를 사용하세요' }, { status: 400 })
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
    const sanitizedComment = comment ? sanitizeUserInput(comment) : null
    const avg = (rentPayment + propertyCondition + neighborIssues + checkoutCondition) / 4
    const overallRating = calcRating(avg)

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

    // 세입자에게 레퍼런스 완료 알림 (비동기)
    notifyReferenceCompleted({
      toUserId: reference.user_id,
      landlordName: reference.landlord_name || '집주인',
      referenceId: reference.id,
    }).catch(() => {})

    return NextResponse.json({ message: '설문이 완료되었습니다. 감사합니다!' })
  } catch (error) {
    console.error('Submit survey error:', error)
    return NextResponse.json({ error: '설문 제출 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// PATCH: 기존 완료된 설문 응답 수정
export async function PATCH(request: Request, { params }: RouteParams) {
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

    if (reference.status !== 'completed') {
      return NextResponse.json({ error: '아직 제출되지 않은 설문입니다' }, { status: 400 })
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
    const sanitizedComment = comment ? sanitizeUserInput(comment) : null
    const avg = (rentPayment + propertyCondition + neighborIssues + checkoutCondition) / 4
    const overallRating = calcRating(avg)

    const [updated] = await query<ReferenceResponse>(
      `UPDATE reference_responses
       SET rent_payment        = $1,
           property_condition  = $2,
           neighbor_issues     = $3,
           checkout_condition  = $4,
           would_recommend     = $5,
           comment             = $6,
           overall_rating      = $7,
           updated_at          = NOW()
       WHERE reference_id = $8
       RETURNING *`,
      [rentPayment, propertyCondition, neighborIssues, checkoutCondition, wouldRecommend, sanitizedComment, overallRating, reference.id]
    )

    return NextResponse.json({
      message: '설문이 수정되었습니다. 감사합니다!',
      response: updated,
    })
  } catch (error) {
    console.error('Update survey error:', error)
    return NextResponse.json({ error: '설문 수정 중 오류가 발생했습니다' }, { status: 500 })
  }
}
