import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, logAdminAction } from '@/lib/admin'
import { query, queryOne } from '@/lib/db'
import { recalculateTrustScoreForUser } from '@/lib/trust-score-recalculator'
import { ValidationValue } from '@/types/database'

type ReviewAction = 'confirm' | 'reject' | 'correct' | 'expire' | 'dispute'

interface ReviewBody {
  action?: ReviewAction
  validationScore?: number | null
  validationNumeric?: string | number | null
  validationText?: string | null
  validationFlag?: string | null
  sourceComment?: string | null
  reasonCodes?: string[]
  validUntil?: string | null
  retentionUntil?: string | null
  metadata?: Record<string, unknown>
  reviewComment?: string
}

interface ReviewState {
  status: ValidationValue['status']
  reviewStatus: NonNullable<ValidationValue['review_status']>
}

const ACTION_STATES: Record<ReviewAction, ReviewState> = {
  confirm: { status: 'valid', reviewStatus: 'confirmed' },
  reject: { status: 'needs_review', reviewStatus: 'rejected' },
  correct: { status: 'valid', reviewStatus: 'corrected' },
  expire: { status: 'stale', reviewStatus: 'expired' },
  dispute: { status: 'disputed', reviewStatus: 'disputed' },
}

function normalizeNullableText(value: unknown, fallback: string | null): string | null {
  if (value === undefined) return fallback
  if (value === null) return null
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeNullableNumeric(value: unknown, fallback: string | null): string | null {
  if (value === undefined) return fallback
  if (value === null || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    throw new Error('validationNumeric 값이 유효하지 않습니다')
  }
  return String(numeric)
}

function normalizeNullableInteger(value: unknown, fallback: number | null): number | null {
  if (value === undefined) return fallback
  if (value === null || value === '') return null
  const numeric = Number(value)
  if (!Number.isInteger(numeric)) {
    throw new Error('validationScore 값이 유효하지 않습니다')
  }
  return numeric
}

function normalizeNullableDate(value: unknown, fallback: Date | string | null | undefined): string | null {
  if (value === undefined) {
    if (!fallback) return null
    return fallback instanceof Date ? fallback.toISOString() : String(fallback)
  }
  if (value === null || value === '') return null
  if (typeof value !== 'string') {
    throw new Error('날짜 값이 유효하지 않습니다')
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('날짜 값이 유효하지 않습니다')
  }
  return parsed.toISOString()
}

function normalizeReasonCodes(value: unknown, fallback: string[] | undefined): string[] {
  if (value === undefined) return fallback ?? []
  if (!Array.isArray(value)) {
    throw new Error('reasonCodes는 문자열 배열이어야 합니다')
  }
  return value
    .filter((code): code is string => typeof code === 'string')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20)
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as ReviewBody
  const action = body.action

  if (!action || !Object.prototype.hasOwnProperty.call(ACTION_STATES, action)) {
    return NextResponse.json({ error: '유효하지 않은 action' }, { status: 400 })
  }

  if (action === 'reject' && !body.reviewComment?.trim() && (!body.reasonCodes || body.reasonCodes.length === 0)) {
    return NextResponse.json({ error: '반려 사유를 입력해주세요' }, { status: 400 })
  }

  const current = await queryOne<ValidationValue>(
    'SELECT * FROM validation_values WHERE id = $1',
    [id],
  )

  if (!current) {
    return NextResponse.json({ error: '검증값을 찾을 수 없습니다' }, { status: 404 })
  }

  const state = ACTION_STATES[action]

  try {
    const reasonCodes = normalizeReasonCodes(body.reasonCodes, current.reason_codes)
    const sourceComment = normalizeNullableText(body.sourceComment ?? body.reviewComment, current.source_comment)
    const reviewMetadata = {
      ...normalizeMetadata(body.metadata),
      last_review: {
        action,
        adminId: admin.id,
        comment: body.reviewComment?.trim() || null,
      },
    }

    const [updated] = await query<ValidationValue>(
      `UPDATE validation_values
          SET status = $1,
              review_status = $2,
              validation_score = $3,
              validation_numeric = $4,
              validation_text = $5,
              validation_flag = $6,
              source_comment = $7,
              reason_codes = $8,
              valid_until = $9,
              retention_until = $10,
              reviewed_by = $11,
              reviewed_at = NOW(),
              metadata = COALESCE(metadata, '{}'::jsonb) || $12::jsonb,
              updated_at = NOW()
        WHERE id = $13
        RETURNING *`,
      [
        state.status,
        state.reviewStatus,
        normalizeNullableInteger(body.validationScore, current.validation_score),
        normalizeNullableNumeric(body.validationNumeric, current.validation_numeric),
        normalizeNullableText(body.validationText, current.validation_text),
        normalizeNullableText(body.validationFlag, current.validation_flag),
        sourceComment,
        reasonCodes,
        normalizeNullableDate(body.validUntil, current.valid_until),
        normalizeNullableDate(body.retentionUntil, current.retention_until),
        admin.id,
        JSON.stringify(reviewMetadata),
        id,
      ],
    )

    await logAdminAction(admin.id, `${action}_validation_value`, 'validation_value', id, {
      owner_user_id: current.owner_user_id,
      subject_type: current.subject_type,
      validation_key: current.validation_key,
      status: state.status,
      review_status: state.reviewStatus,
      reason_codes: reasonCodes,
    })

    if (current.subject_type === 'tenant') {
      recalculateTrustScoreForUser(current.owner_user_id).catch(() => {})
    }

    return NextResponse.json({ validationValue: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : '검증값 검수 처리에 실패했습니다'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
