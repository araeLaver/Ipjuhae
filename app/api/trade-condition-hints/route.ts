import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import {
  tradeConditionHintCreateSchema,
  TradeConditionHintCreateInput,
} from '@/lib/validations'
import { TradeConditionHint } from '@/types/database'

const VALID_HINT_LEVELS = ['low', 'normal', 'high', 'critical'] as const

function parseLimit(value: string | null, fallback = 50): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 200)
}

function canManageHint(user: { id: string; user_type: string }, tenantUserId: string, landlordUserId: string) {
  return user.user_type === 'admin' || user.id === tenantUserId || user.id === landlordUserId
}

function parseCreateInput(body: unknown): TradeConditionHintCreateInput {
  const parsed = tradeConditionHintCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다')
  }

  return {
    ...parsed.data,
    propertyId: parsed.data.propertyId || null,
    requiredDocuments: parsed.data.requiredDocuments,
    adjustmentOptions: parsed.data.adjustmentOptions,
    safetyActions: parsed.data.safetyActions,
    snapshot: parsed.data.snapshot,
    validUntil: parsed.data.validUntil || null,
  }
}

function parseHintLevel(raw: string | null) {
  if (!raw) return null
  return (VALID_HINT_LEVELS as readonly string[]).includes(raw)
    ? (raw as (typeof VALID_HINT_LEVELS)[number])
    : null
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const tenantUserId = searchParams.get('tenantUserId')
    const landlordUserId = searchParams.get('landlordUserId')
    const propertyId = searchParams.get('propertyId')
    const hintLevel = parseHintLevel(searchParams.get('hintLevel'))
    const limit = parseLimit(searchParams.get('limit'), 50)
    const includeExpired = searchParams.get('includeExpired') === 'true'

    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (user.user_type !== 'admin') {
      conditions.push(`(tenant_user_id = $${idx} OR landlord_user_id = $${idx})`)
      values.push(user.id)
      idx += 1
    }

    if (tenantUserId) {
      conditions.push(`tenant_user_id = $${idx}`)
      values.push(tenantUserId)
      idx += 1
    }

    if (landlordUserId) {
      conditions.push(`landlord_user_id = $${idx}`)
      values.push(landlordUserId)
      idx += 1
    }

    if (propertyId) {
      conditions.push(`property_id = $${idx}`)
      values.push(propertyId)
      idx += 1
    }

    if (hintLevel) {
      conditions.push(`hint_level = $${idx}`)
      values.push(hintLevel)
      idx += 1
    }

    if (!includeExpired) {
      conditions.push(`(valid_until IS NULL OR valid_until >= NOW())`)
    }

    values.push(limit)
    const limitIdx = idx

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const rows = await query<TradeConditionHint>(
      `SELECT *
       FROM trade_condition_hints
       ${whereSql}
       ORDER BY updated_at DESC
       LIMIT $${limitIdx}`,
      values,
    )

    return NextResponse.json({ hints: rows })
  } catch (error) {
    console.error('Get trade condition hints error:', error)
    return NextResponse.json({ error: '거래조건 힌트 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: '요청 본문이 필요합니다' }, { status: 400 })
    }

    const payload = parseCreateInput(body)

    if (!canManageHint(user, payload.tenantUserId, payload.landlordUserId)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const rows = await query<TradeConditionHint>(
      `INSERT INTO trade_condition_hints
         (tenant_user_id, landlord_user_id, property_id, hint_level, required_documents, adjustment_options, safety_actions, snapshot, valid_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        payload.tenantUserId,
        payload.landlordUserId,
        payload.propertyId || null,
        payload.hintLevel,
        payload.requiredDocuments,
        payload.adjustmentOptions,
        payload.safetyActions,
        payload.snapshot,
        payload.validUntil,
      ],
    )

    return NextResponse.json({ hint: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Create trade condition hint error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '거래조건 힌트 생성에 실패했습니다' }, { status: 400 })
  }
}
