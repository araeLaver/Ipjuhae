import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { TradeConditionHint } from '@/types/database'
import { tradeConditionHintUpdateSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

function canManageHint(user: { id: string; user_type: string }, tenantUserId: string, landlordUserId: string) {
  return user.user_type === 'admin' || user.id === tenantUserId || user.id === landlordUserId
}

function parseUpdateInput(body: unknown) {
  const parsed = tradeConditionHintUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다')
  }
  return parsed.data
}

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  try {
    const { id } = await params
    const hint = await queryOne<TradeConditionHint>(
      'SELECT * FROM trade_condition_hints WHERE id = $1',
      [id],
    )

    if (!hint) {
      return NextResponse.json({ error: '거래조건 힌트를 찾을 수 없습니다' }, { status: 404 })
    }

    if (!canManageHint(user, hint.tenant_user_id, hint.landlord_user_id)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    return NextResponse.json({ hint })
  } catch (error) {
    console.error('Get trade condition hint error:', error)
    return NextResponse.json({ error: '거래조건 힌트 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: '요청 본문이 필요합니다' }, { status: 400 })
    }

    const payload = parseUpdateInput(body)

    const original = await queryOne<TradeConditionHint>(
      'SELECT * FROM trade_condition_hints WHERE id = $1',
      [id],
    )

    if (!original) {
      return NextResponse.json({ error: '거래조건 힌트를 찾을 수 없습니다' }, { status: 404 })
    }

    const nextTenantUserId = payload.tenantUserId ?? original.tenant_user_id
    const nextLandlordUserId = payload.landlordUserId ?? original.landlord_user_id

    if (!canManageHint(user, nextTenantUserId, nextLandlordUserId)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const setClauses: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (payload.tenantUserId !== undefined) {
      setClauses.push(`tenant_user_id = $${idx++}`)
      values.push(payload.tenantUserId)
    }

    if (payload.landlordUserId !== undefined) {
      setClauses.push(`landlord_user_id = $${idx++}`)
      values.push(payload.landlordUserId)
    }

    if (payload.propertyId !== undefined) {
      setClauses.push(`property_id = $${idx++}`)
      values.push(payload.propertyId || null)
    }

    if (payload.hintLevel !== undefined) {
      setClauses.push(`hint_level = $${idx++}`)
      values.push(payload.hintLevel)
    }

    if (payload.requiredDocuments !== undefined) {
      setClauses.push(`required_documents = $${idx++}`)
      values.push(payload.requiredDocuments)
    }

    if (payload.adjustmentOptions !== undefined) {
      setClauses.push(`adjustment_options = $${idx++}`)
      values.push(payload.adjustmentOptions)
    }

    if (payload.safetyActions !== undefined) {
      setClauses.push(`safety_actions = $${idx++}`)
      values.push(payload.safetyActions)
    }

    if (payload.snapshot !== undefined) {
      setClauses.push(`snapshot = $${idx++}`)
      values.push(payload.snapshot)
    }

    if (payload.validUntil !== undefined) {
      setClauses.push(`valid_until = $${idx++}`)
      values.push(payload.validUntil)
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: '업데이트할 내용이 없습니다' }, { status: 400 })
    }

    setClauses.push('updated_at = NOW()')
    values.push(id)

    const hint = await queryOne<TradeConditionHint>(
      `UPDATE trade_condition_hints
       SET ${setClauses.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values,
    )

    if (!hint) {
      return NextResponse.json({ error: '거래조건 힌트를 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ hint })
  } catch (error) {
    console.error('Update trade condition hint error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '거래조건 힌트 수정 중 오류가 발생했습니다' },
      { status: 400 },
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  try {
    const { id } = await params
    const hint = await queryOne<TradeConditionHint>(
      'SELECT * FROM trade_condition_hints WHERE id = $1',
      [id],
    )

    if (!hint) {
      return NextResponse.json({ error: '거래조건 힌트를 찾을 수 없습니다' }, { status: 404 })
    }

    if (!canManageHint(user, hint.tenant_user_id, hint.landlord_user_id)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    await query('DELETE FROM trade_condition_hints WHERE id = $1', [id])

    return NextResponse.json({ message: '거래조건 힌트가 삭제되었습니다' })
  } catch (error) {
    console.error('Delete trade condition hint error:', error)
    return NextResponse.json({ error: '거래조건 힌트 삭제 중 오류가 발생했습니다' }, { status: 500 })
  }
}
