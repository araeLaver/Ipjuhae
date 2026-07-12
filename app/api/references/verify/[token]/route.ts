import { NextResponse } from 'next/server'
import { query, queryOne, transaction } from '@/lib/db'
import { LandlordReference, Profile, ReferenceResponse } from '@/types/database'
import { referenceSurveySchema } from '@/lib/validations'
import { apiRateLimit, getClientIp } from '@/lib/rate-limit'
import { sanitizeUserInput } from '@/lib/sanitize'
import { notifyReferenceCompleted } from '@/lib/notifications'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { getRequestContext } from '@/lib/request-context'
import { withIdempotency } from '@/lib/idempotency'

interface RouteParams {
  params: Promise<{ token: string }>
}

type ReferenceResponseRow = Omit<ReferenceResponse, 'editable_until'> & {
  editable_until: string | Date | null
  status?: string
}

const TOKEN_ACCESS_WINDOW_MS = 15 * 60 * 1000
const TOKEN_ACCESS_LIMIT = 20
const TOKEN_BLOCK_MS = 15 * 60 * 1000
const IDEMPOTENCY_KEY_MAX_LENGTH = 128

type TokenOperation = 'verify' | 'submit' | 'update'

interface TokenAccessResult {
  reference: LandlordReference | null
  blockedUntil: Date | null
}

async function registerTokenAccess(
  request: Request,
  token: string,
  operation: TokenOperation,
): Promise<TokenAccessResult> {
  const ip = getClientIp(request).slice(0, 45)
  const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 512)
  const { requestId, traceId } = getRequestContext(request)

  return transaction(async (client) => {
    const selected = await client.query(
      `SELECT *
         FROM landlord_references
        WHERE verification_token = $1
        FOR UPDATE`,
      [token]
    )
    const reference = (selected.rows[0] as LandlordReference | undefined) ?? null
    if (!reference) return { reference: null, blockedUntil: null }

    const now = new Date()
    const currentBlockedUntil = reference.token_blocked_until
      ? new Date(reference.token_blocked_until)
      : null

    if (currentBlockedUntil && currentBlockedUntil.getTime() > now.getTime()) {
      const blockedMetadata = JSON.stringify({
        last_outcome: 'blocked',
        last_operation: operation,
        last_request_id: requestId,
        last_trace_id: traceId,
        last_ip: ip,
        last_user_agent: userAgent,
        last_attempted_at: now.toISOString(),
      })
      await client.query(
        `UPDATE landlord_references
            SET token_verification_metadata = COALESCE(token_verification_metadata, '{}'::jsonb) || $1::jsonb
          WHERE id = $2`,
        [blockedMetadata, reference.id]
      )
      return { reference, blockedUntil: currentBlockedUntil }
    }

    const lastAccessedAt = reference.token_last_accessed_at
      ? new Date(reference.token_last_accessed_at)
      : null
    const inCurrentWindow = Boolean(
      lastAccessedAt && now.getTime() - lastAccessedAt.getTime() < TOKEN_ACCESS_WINDOW_MS
    )
    const attempts = inCurrentWindow ? reference.token_access_attempts + 1 : 1
    const shouldBlock = attempts > TOKEN_ACCESS_LIMIT
    const blockedUntil = shouldBlock ? new Date(now.getTime() + TOKEN_BLOCK_MS) : null
    const storedWindowStartedAt = reference.token_verification_metadata?.access_window_started_at
    const windowStartedAt = inCurrentWindow && typeof storedWindowStartedAt === 'string'
      ? storedWindowStartedAt
      : now.toISOString()
    const metadata = JSON.stringify({
      last_outcome: shouldBlock ? 'blocked' : 'allowed',
      last_operation: operation,
      last_request_id: requestId,
      last_trace_id: traceId,
      last_ip: ip,
      last_user_agent: userAgent,
      last_attempted_at: now.toISOString(),
      access_window_started_at: windowStartedAt,
      access_window_ms: TOKEN_ACCESS_WINDOW_MS,
      access_limit: TOKEN_ACCESS_LIMIT,
    })

    const updated = await client.query(
      `UPDATE landlord_references
          SET token_access_attempts = $1,
              token_last_accessed_at = $2,
              token_last_accessed_ip = $3,
              token_blocked_until = $4,
              token_verification_metadata = COALESCE(token_verification_metadata, '{}'::jsonb) || $5::jsonb
        WHERE id = $6
        RETURNING *`,
      [attempts, now, ip, blockedUntil, metadata, reference.id]
    )

    return {
      reference: updated.rows[0] as LandlordReference,
      blockedUntil,
    }
  })
}

function tokenBlockedResponse(request: Request, blockedUntil: Date) {
  const retryAfter = Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000))
  const response = jsonError(
    request,
    429,
    'Reference token is temporarily blocked due to excessive access attempts',
    'REFERENCE_TOKEN_TEMPORARILY_BLOCKED'
  )
  response.headers.set('Retry-After', String(retryAfter))
  return response
}

function getIdempotencyKey(request: Request): string | null {
  const key = request.headers.get('idempotency-key')?.trim()
  return key || null
}

function calcRating(avg: number): string {
  if (avg >= 4) return 'positive'
  if (avg < 2.5) return 'negative'
  return 'neutral'
}

function calcEditableUntil(reference: { completed_at?: Date | string | null, status?: string }): Date | null {
  if (reference.status !== 'completed') return null

  if (reference.completed_at) {
    const editableUntil = new Date(reference.completed_at)
    editableUntil.setDate(editableUntil.getDate() + 7)
    return editableUntil
  }

  return null
}

function canEdit(reference: { completed_at?: Date | string | null, status?: string }): boolean {
  const editableUntil = calcEditableUntil(reference)
  if (!editableUntil) return false
  return editableUntil.getTime() > Date.now()
}

function compareChange<T>(previous: T, next: T) {
  if (previous === next) return false
  return true
}

const SCORE_FIELDS = [
  'rent_payment',
  'property_condition',
  'neighbor_issues',
  'checkout_condition',
  'would_recommend',
  'comment',
  'overall_rating',
] as const

type ScoreField = (typeof SCORE_FIELDS)[number]

function buildDiff(previous: ReferenceResponse, next: {
  rent_payment: number
  property_condition: number
  neighbor_issues: number
  checkout_condition: number
  would_recommend: boolean
  comment: string | null
}) {
  const proposed: Record<ScoreField, string | number | boolean | null> = {
    rent_payment: next.rent_payment,
    property_condition: next.property_condition,
    neighbor_issues: next.neighbor_issues,
    checkout_condition: next.checkout_condition,
    would_recommend: next.would_recommend,
    comment: next.comment,
    overall_rating: calcRating(
      (next.rent_payment + next.property_condition + next.neighbor_issues + next.checkout_condition) / 4
    ),
  }

  const previousPayload: Record<ScoreField, string | number | boolean | null> = {
    rent_payment: previous.rent_payment,
    property_condition: previous.property_condition,
    neighbor_issues: previous.neighbor_issues,
    checkout_condition: previous.checkout_condition,
    would_recommend: previous.would_recommend,
    comment: previous.comment,
    overall_rating: previous.overall_rating,
  }

  const changedFields = SCORE_FIELDS.filter((field) => compareChange(previousPayload[field], proposed[field]))
  const nextPayload: Omit<ReferenceResponseRow, 'id'> = {
    reference_id: previous.reference_id,
    rent_payment: next.rent_payment,
    property_condition: next.property_condition,
    neighbor_issues: next.neighbor_issues,
    checkout_condition: next.checkout_condition,
    would_recommend: next.would_recommend,
    comment: next.comment,
    overall_rating: proposed.overall_rating as string,
    created_at: previous.created_at,
    editable_until: previous.editable_until ?? null,
    updated_at: previous.updated_at,
  }

  return {
    changedFields,
    nextPayload,
  }
}

function rateLimitResponse(request: Request, rl: { resetAt: number }) {
  const { requestId, traceId } = getRequestContext(request)
  const response = NextResponse.json(
    {
      error: 'Too many requests. Please retry later.',
      code: 'RATE_LIMITED',
      request_id: requestId,
      trace_id: traceId,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
      },
    }
  )
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-trace-id', traceId)
  return response
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request)
    const rl = apiRateLimit(ip)
    if (!rl.success) {
      return rateLimitResponse(request, rl)
    }

    const { token } = await params

    const access = await registerTokenAccess(request, token, 'verify')
    const reference = access.reference

    if (!reference) {
      return jsonError(request, 404, 'Reference token is not valid', 'REFERENCE_TOKEN_INVALID')
    }

    if (access.blockedUntil) {
      return tokenBlockedResponse(request, access.blockedUntil)
    }

    if (
      reference.status !== 'completed' &&
      reference.token_expires_at &&
      new Date(reference.token_expires_at) < new Date()
    ) {
      return jsonError(request, 400, 'Reference token has expired', 'REFERENCE_TOKEN_EXPIRED')
    }

    const profile = await queryOne<Profile>('SELECT * FROM profiles WHERE user_id = $1', [reference.user_id])

    const existingResponse = await queryOne<ReferenceResponseRow>(
      'SELECT * FROM reference_responses WHERE reference_id = $1',
      [reference.id]
    )

    const editableTarget = existingResponse ?? reference
    const editableUntil = calcEditableUntil(editableTarget)
    const editable = canEdit(editableTarget)

    if (reference.status === 'completed') {
      return jsonSuccess(request, {
        valid: true,
        completed: true,
        editable,
        editableUntil: editableUntil?.toISOString() ?? null,
        tenantName: profile?.name || 'tenant',
        referenceId: reference.id,
        existingResponse: existingResponse ?? null,
      })
    }

    return jsonSuccess(request, {
      valid: true,
      completed: false,
      editable: false,
      editableUntil: null,
      tenantName: profile?.name || 'tenant',
      referenceId: reference.id,
    })
  } catch (error) {
    console.error('Verify token error:', error)
    return jsonError(request, 500, 'Failed to check reference token', 'REFERENCE_TOKEN_CHECK_FAILED')
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request)
    const rl = apiRateLimit(ip)
    if (!rl.success) {
      return rateLimitResponse(request, rl)
    }

    const { token } = await params
    const idempotencyKey = getIdempotencyKey(request)
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return jsonError(request, 400, 'Idempotency-Key is too long', 'IDEMPOTENCY_KEY_INVALID')
    }

    return withIdempotency({
      request,
      namespace: 'reference-survey-submit',
      key: idempotencyKey,
      ttlMinutes: 24 * 60,
      handler: async () => {
    const access = await registerTokenAccess(request, token, 'submit')
    const reference = access.reference

    if (!reference) {
      return jsonError(request, 404, 'Reference token is not valid', 'REFERENCE_TOKEN_INVALID')
    }

    if (access.blockedUntil) {
      return tokenBlockedResponse(request, access.blockedUntil)
    }

    if (reference.token_expires_at && new Date(reference.token_expires_at) < new Date()) {
      return jsonError(request, 400, 'Reference token has expired', 'REFERENCE_TOKEN_EXPIRED')
    }

    if (reference.status === 'completed') {
      return jsonError(
        request,
        400,
        'This reference already completed. Use PATCH to update within the editable period.',
        'REFERENCE_ALREADY_COMPLETED'
      )
    }

    const body = await request.json()
    const parsed = referenceSurveySchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(request, 400, parsed.error.issues[0]?.message || 'Invalid request payload', 'INVALID_PAYLOAD')
    }

    const { rentPayment, propertyCondition, neighborIssues, checkoutCondition, wouldRecommend, comment } = parsed.data
    const sanitizedComment = comment ? sanitizeUserInput(comment) : null
    const avg = (rentPayment + propertyCondition + neighborIssues + checkoutCondition) / 4
    const overallRating = calcRating(avg)
    const editableUntil = new Date()
    editableUntil.setDate(editableUntil.getDate() + 7)

    const created = await transaction(async (client) => {
      const claimed = await client.query(
        `UPDATE landlord_references
            SET status = 'completed',
                completed_at = NOW()
          WHERE id = $1
            AND status <> 'completed'
        RETURNING id`,
        [reference.id]
      )
      if (claimed.rowCount === 0) return false

      await client.query(
        `INSERT INTO reference_responses
          (reference_id, rent_payment, property_condition, neighbor_issues, checkout_condition, would_recommend, comment, overall_rating, editable_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          reference.id,
          rentPayment,
          propertyCondition,
          neighborIssues,
          checkoutCondition,
          wouldRecommend,
          sanitizedComment,
          overallRating,
          editableUntil,
        ]
      )
      return true
    })

    if (!created) {
      return jsonError(request, 409, 'This reference already completed', 'REFERENCE_ALREADY_COMPLETED')
    }

    notifyReferenceCompleted({
      toUserId: reference.user_id,
      landlordName: reference.landlord_name || 'landlord',
      referenceId: reference.id,
    }).catch(() => {})

    return jsonSuccess(request, {
      message: 'Reference survey submitted',
    }, 201)
      },
    })
  } catch (error) {
    console.error('Submit survey error:', error)
    return jsonError(request, 500, 'Failed to submit reference survey', 'REFERENCE_SUBMIT_FAILED')
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const ip = getClientIp(request)
    const rl = apiRateLimit(ip)
    if (!rl.success) {
      return rateLimitResponse(request, rl)
    }

    const { token } = await params
    const idempotencyKey = getIdempotencyKey(request)
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      return jsonError(request, 400, 'Idempotency-Key is too long', 'IDEMPOTENCY_KEY_INVALID')
    }

    return withIdempotency({
      request,
      namespace: 'reference-survey-update',
      key: idempotencyKey,
      ttlMinutes: 24 * 60,
      handler: async () => {
    const access = await registerTokenAccess(request, token, 'update')
    const reference = access.reference

    if (!reference) {
      return jsonError(request, 404, 'Reference token is not valid', 'REFERENCE_TOKEN_INVALID')
    }

    if (access.blockedUntil) {
      return tokenBlockedResponse(request, access.blockedUntil)
    }

    if (reference.status !== 'completed') {
      return jsonError(request, 400, 'Only completed references can be updated', 'REFERENCE_NOT_COMPLETED')
    }

    if (!canEdit(reference)) {
      return jsonError(request, 400, 'Editable window has expired', 'REFERENCE_EDIT_WINDOW_EXPIRED')
    }

    const existingResponse = await queryOne<ReferenceResponse>(
      `SELECT rr.*
       FROM reference_responses rr
       JOIN landlord_references lr ON rr.reference_id = lr.id
       WHERE lr.id = $1`,
      [reference.id]
    )

    if (!existingResponse) {
      return jsonError(request, 404, 'Existing survey result not found', 'REFERENCE_RESPONSE_NOT_FOUND')
    }

    const body = await request.json()
    const parsed = referenceSurveySchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(request, 400, parsed.error.issues[0]?.message || 'Invalid request payload', 'INVALID_PAYLOAD')
    }

    const { rentPayment, propertyCondition, neighborIssues, checkoutCondition, wouldRecommend, comment } = parsed.data
    const sanitizedComment = comment ? sanitizeUserInput(comment) : null
    const avg = (rentPayment + propertyCondition + neighborIssues + checkoutCondition) / 4
    const overallRating = calcRating(avg)

    const { changedFields } = buildDiff(existingResponse, {
      rent_payment: rentPayment,
      property_condition: propertyCondition,
      neighbor_issues: neighborIssues,
      checkout_condition: checkoutCondition,
      would_recommend: wouldRecommend,
      comment: sanitizedComment,
    })

    const updatedRows = await query<ReferenceResponse>(
      `UPDATE reference_responses
       SET rent_payment = $1,
           property_condition = $2,
           neighbor_issues = $3,
           checkout_condition = $4,
           would_recommend = $5,
           comment = $6,
           overall_rating = $7,
           updated_at = NOW()
       WHERE reference_id = $8
       RETURNING *`,
      [
        rentPayment,
        propertyCondition,
        neighborIssues,
        checkoutCondition,
        wouldRecommend,
        sanitizedComment,
        overallRating,
        reference.id,
      ]
    )

    const updated = updatedRows[0]
    if (!updated) {
      return jsonError(request, 404, 'Reference response not found for update', 'REFERENCE_RESPONSE_NOT_FOUND')
    }

    await query(
      `INSERT INTO reference_response_history
       (reference_response_id, previous_data, changed_by, changed_fields)
       VALUES ($1, $2, $3, $4)`,
      [
        existingResponse.id,
        existingResponse,
        null,
        changedFields,
      ]
    )

    return jsonSuccess(request, {
      message: 'Reference survey updated',
      response: updated,
      changedFields,
    })
      },
    })
  } catch (error) {
    console.error('Update survey error:', error)
    return jsonError(request, 500, 'Failed to update reference survey', 'REFERENCE_UPDATE_FAILED')
  }
}
