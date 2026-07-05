import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { consentUpdateSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

function normalizeUpdatePayload(payload: unknown) {
  const parsed = consentUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다')
  }
  return parsed.data
}

function dedupe(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params
    const consent = await queryOne(
      'SELECT * FROM consents WHERE id = $1 AND owner_user_id = $2',
      [id, user.id],
    )

    if (!consent) {
      return NextResponse.json({ error: '동의를 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ consent })
  } catch (error) {
    console.error('Get consent error:', error)
    return NextResponse.json({ error: '동의 조회 중 오류가 발생했습니다' }, { status: 500 })
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

    const data = normalizeUpdatePayload(body)

    const setClauses: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (data.viewerUserId !== undefined) {
      setClauses.push(`viewer_user_id = $${idx++}`)
      values.push(data.viewerUserId)
    }
    if (data.viewerRole !== undefined) {
      setClauses.push(`viewer_role = $${idx++}`)
      values.push(data.viewerRole)
    }
    if (data.resourceType !== undefined) {
      setClauses.push(`resource_type = $${idx++}`)
      values.push(data.resourceType)
    }
    if (data.resourceId !== undefined) {
      setClauses.push(`resource_id = $${idx++}`)
      values.push(data.resourceId)
    }
    if (data.allowedFields !== undefined) {
      setClauses.push(`allowed_fields = $${idx++}`)
      values.push(dedupe(data.allowedFields) || ['*'])
    }
    if (data.allowedPurposes !== undefined) {
      setClauses.push(`allowed_purposes = $${idx++}`)
      values.push(dedupe(data.allowedPurposes) || [])
    }
    if (data.canViewContact !== undefined) {
      setClauses.push(`can_view_contact = $${idx++}`)
      values.push(data.canViewContact)
    }
    if (data.validFrom !== undefined) {
      setClauses.push(`valid_from = $${idx++}`)
      values.push(data.validFrom)
    }
    if (data.validUntil !== undefined) {
      setClauses.push(`valid_until = $${idx++}`)
      values.push(data.validUntil)
    }
    if (data.metadata !== undefined) {
      setClauses.push(`metadata = $${idx++}`)
      values.push(data.metadata)
    }
    if (data.revoked === true) {
      setClauses.push(`revoked_at = NOW()`)
    } else if (data.revoked === false) {
      setClauses.push(`revoked_at = NULL`)
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: '업데이트할 내용이 없습니다' }, { status: 400 })
    }

    setClauses.push(`updated_at = NOW()`)

    values.push(id, user.id)
    const consent = await queryOne(
      `
        UPDATE consents
           SET ${setClauses.join(', ')}
         WHERE id = $${idx} AND owner_user_id = $${idx + 1}
         RETURNING *
      `,
      [...values],
    )

    if (!consent) {
      return NextResponse.json({ error: '동의를 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ consent })
  } catch (error) {
    console.error('Update consent error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '동의 수정 중 오류가 발생했습니다' }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params
    const consent = await queryOne(
      'UPDATE consents SET revoked_at = NOW(), updated_at = NOW() WHERE id = $1 AND owner_user_id = $2 RETURNING *',
      [id, user.id],
    )

    if (!consent) {
      return NextResponse.json({ error: '동의를 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ consent, message: '동의가 철회되었습니다' })
  } catch (error) {
    console.error('Revoke consent error:', error)
    return NextResponse.json({ error: '동의 철회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
