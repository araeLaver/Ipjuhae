import { NextResponse } from 'next/server'
import { query, queryOne, transaction } from '@/lib/db'
import {
  LandlordReference,
  Profile,
  ReferenceResponse,
  ReferenceResponseItem,
} from '@/types/database'
import { normalizeReferenceSurveyInput, ReferenceSurveyNormalizedPayload } from '@/lib/validations'
import { apiRateLimit, getClientIp } from '@/lib/rate-limit'
import { sanitizeUserInput } from '@/lib/sanitize'
import { notifyReferenceCompleted } from '@/lib/notifications'
import { recalculateTrustScoreForUser } from '@/lib/trust-score-recalculator'

interface RouteParams {
  params: Promise<{ token: string }>
}

function calcRating(avg: number): string {
  if (avg >= 4) return 'positive'
  if (avg < 2.5) return 'negative'
  return 'neutral'
}

function toAvgScore(payload: ReferenceSurveyNormalizedPayload): number {
  return (
    payload.rentPayment +
    payload.propertyCondition +
    payload.neighborIssues +
    payload.checkoutCondition
  ) / 4
}

// GET: 토큰 유효성 확인 (completed이면 기존 응답 함께 반환)
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request)
    const rl = apiRateLimit(ip)
    if (!rl.success) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      )
    }

    const { token } = await params

    const reference = await queryOne<LandlordReference & { tenant_name?: string }>(
      `SELECT lr.*, p.name as tenant_name
       FROM landlord_references lr
       LEFT JOIN profiles p ON COALESCE(lr.subject_user_id, lr.user_id) = p.user_id
       WHERE lr.verification_token = $1`,
      [token],
    )

    if (!reference) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다' }, { status: 404 })
    }

    if (
      reference.status !== 'completed' &&
      reference.token_expires_at &&
      new Date(reference.token_expires_at) < new Date()
    ) {
      return NextResponse.json({ error: '링크가 만료되었습니다' }, { status: 400 })
    }

    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [reference.subject_user_id ?? reference.user_id],
    )

    if (reference.status === 'completed') {
      const existingResponse = await queryOne<ReferenceResponse>(
        'SELECT * FROM reference_responses WHERE reference_id = $1',
        [reference.id],
      )

      const existingResponseItems = existingResponse
        ? await query<ReferenceResponseItem>(
            'SELECT * FROM reference_response_items WHERE response_id = $1 ORDER BY item_code',
            [existingResponse.id],
          )
        : []

      return NextResponse.json({
        valid: true,
        completed: true,
        editable: true,
        tenantName: profile?.name || '세입자',
        referenceId: reference.id,
        existingResponse,
        existingResponseItems,
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
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      )
    }

    const { token } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE verification_token = $1',
      [token],
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
    const normalized = normalizeReferenceSurveyInput(body)
    if (normalized.error || !normalized.data) {
      return NextResponse.json(
        { error: normalized.error || '입력값이 올바르지 않습니다' },
        { status: 400 },
      )
    }
    const data = normalized.data

    const sanitizedComment = data.comment ? sanitizeUserInput(data.comment) : null
    const avg = toAvgScore(data)
    const overallRating = calcRating(avg)

    await transaction(async (client) => {
        const response = await client.query<ReferenceResponse>(
          `INSERT INTO reference_responses
          (reference_id, rent_payment, property_condition, neighbor_issues, checkout_condition,
           would_recommend, comment, overall_rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          reference.id,
          data.rentPayment,
          data.propertyCondition,
          data.neighborIssues,
          data.checkoutCondition,
          data.wouldRecommend,
          sanitizedComment,
          overallRating,
        ],
      )

      const responseId = response.rows[0].id
      if (data.items.length > 0) {
        await client.query('DELETE FROM reference_response_items WHERE response_id = $1', [responseId])
        for (const item of data.items) {
          await client.query(
            `INSERT INTO reference_response_items
              (response_id, item_code, item_score, item_comment)
             VALUES ($1, $2, $3, $4)`,
            [responseId, item.itemCode, item.itemScore, item.itemComment],
          )
        }
      }

      await client.query(
        `UPDATE landlord_references
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [reference.id],
      )
    })

    recalculateTrustScoreForUser(reference.subject_user_id ?? reference.user_id).catch(() => {})

    notifyReferenceCompleted({
      toUserId: reference.subject_user_id ?? reference.user_id,
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
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      )
    }

    const { token } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE verification_token = $1',
      [token],
    )

    if (!reference) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다' }, { status: 404 })
    }

    if (reference.status !== 'completed') {
      return NextResponse.json({ error: '아직 제출되지 않은 설문입니다' }, { status: 400 })
    }

    const body = await request.json()
    const normalized = normalizeReferenceSurveyInput(body)
    if (normalized.error || !normalized.data) {
      return NextResponse.json(
        { error: normalized.error || '입력값이 올바르지 않습니다' },
        { status: 400 },
      )
    }
    const data = normalized.data

    const sanitizedComment = data.comment ? sanitizeUserInput(data.comment) : null
    const avg = toAvgScore(data)
    const overallRating = calcRating(avg)

    const updatedResponse = await transaction(async (client) => {
      const existing = await client.query<ReferenceResponse>(
        'SELECT * FROM reference_responses WHERE reference_id = $1',
        [reference.id],
      )

      let response: ReferenceResponse
      if (existing.rows.length === 0) {
        const inserted = await client.query<ReferenceResponse>(
          `INSERT INTO reference_responses
            (reference_id, rent_payment, property_condition, neighbor_issues, checkout_condition,
             would_recommend, comment, overall_rating)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            reference.id,
            data.rentPayment,
            data.propertyCondition,
            data.neighborIssues,
            data.checkoutCondition,
            data.wouldRecommend,
            sanitizedComment,
            overallRating,
          ],
        )
        response = inserted.rows[0]
      } else {
        const updated = await client.query<ReferenceResponse>(
           `UPDATE reference_responses
           SET rent_payment       = $1,
               property_condition = $2,
               neighbor_issues    = $3,
               checkout_condition = $4,
               would_recommend    = $5,
               comment            = $6,
               overall_rating     = $7,
               updated_at         = NOW()
           WHERE reference_id = $8
           RETURNING *`,
          [
            data.rentPayment,
            data.propertyCondition,
            data.neighborIssues,
            data.checkoutCondition,
            data.wouldRecommend,
            sanitizedComment,
            overallRating,
            reference.id,
          ],
        )
        response = updated.rows[0]
      }

      await client.query('DELETE FROM reference_response_items WHERE response_id = $1', [response.id])
      for (const item of data.items) {
        await client.query(
          `INSERT INTO reference_response_items
             (response_id, item_code, item_score, item_comment)
           VALUES ($1, $2, $3, $4)`,
          [response.id, item.itemCode, item.itemScore, item.itemComment],
        )
      }

      await client.query(
        `UPDATE landlord_references SET updated_at = NOW() WHERE id = $1`,
        [reference.id],
      )

      return response
    })

    recalculateTrustScoreForUser(reference.subject_user_id ?? reference.user_id).catch(() => {})

    return NextResponse.json({
      message: '설문이 수정되었습니다. 감사합니다!',
      response: updatedResponse,
    })
  } catch (error) {
    console.error('Update survey error:', error)
    return NextResponse.json({ error: '설문 수정 중 오류가 발생했습니다' }, { status: 500 })
  }
}
