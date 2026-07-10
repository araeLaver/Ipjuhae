import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { consentCreateSchema, ConsentCreateInput } from '@/lib/validations'

type ConsentRouteQuery = {
  viewerUserId?: string | null
  viewerRole?: string | null
  resourceType?: 'profile' | 'reference' | 'property' | 'document' | 'trade_hint' | 'all' | null
  includeRevoked?: 'true' | 'false' | null
}

function parseIntParam(value: string | null, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 200)
}

function normalizeMetadataArray(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return ['*']
  const seen = new Set<string>()
  for (const value of values) {
    if (value.trim()) seen.add(value.trim())
  }
  return Array.from(seen)
}

function uniqueStringArray(values: string[] | undefined): string[] {
  if (!values) return []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = value.trim()
    if (normalized) seen.add(normalized)
  }
  return Array.from(seen)
}

function parseCreateInput(body: unknown): ConsentCreateInput {
  const parsed = consentCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다')
  }

  const validFrom = parsed.data.validFrom || new Date().toISOString()

  return {
    ...parsed.data,
    validFrom,
    allowedFields: normalizeMetadataArray(parsed.data.allowedFields),
    allowedPurposes: uniqueStringArray(parsed.data.allowedPurposes),
    metadata: parsed.data.metadata || {},
    validUntil: parsed.data.validUntil || null,
  }
}

// GET: 내 동의 목록
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = {
      viewerUserId: searchParams.get('viewerUserId'),
      viewerRole: searchParams.get('viewerRole'),
      resourceType: searchParams.get('resourceType') as ConsentRouteQuery['resourceType'],
      includeRevoked: searchParams.get('includeRevoked') as ConsentRouteQuery['includeRevoked'],
    }

    const limit = parseIntParam(searchParams.get('limit'), 50)
    const whereSql: string[] = ['owner_user_id = $1']
    const values: unknown[] = [user.id]
    let idx = 2

    if (queryParams.viewerUserId) {
      whereSql.push(`viewer_user_id = $${idx}`)
      values.push(queryParams.viewerUserId)
      idx += 1
    }

    if (queryParams.viewerRole) {
      whereSql.push(`viewer_role = $${idx}`)
      values.push(queryParams.viewerRole)
      idx += 1
    }

    if (queryParams.resourceType) {
      whereSql.push(`resource_type = $${idx}`)
      values.push(queryParams.resourceType)
      idx += 1
    }

    if (queryParams.includeRevoked !== 'true') {
      whereSql.push('(revoked_at IS NULL OR revoked_at > NOW())')
    }

    values.push(limit)

    const consents = await query(
      `SELECT *
         FROM consents
        WHERE ${whereSql.join(' AND ')}
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT $${idx}`,
      values,
    )

    return NextResponse.json({ consents })
  } catch (error) {
    console.error('Get consents error:', error)
    return NextResponse.json({ error: '동의 목록 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST: 동의 생성
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

    const rows = await query<{
      id: string
      owner_user_id: string
      viewer_user_id: string | null
      viewer_role: string | null
      resource_type: string
      resource_id: string | null
      allowed_fields: string[]
      allowed_purposes: string[]
      can_view_contact: boolean
      valid_from: string
      valid_until: string | null
      revoked_at: string | null
      metadata: Record<string, unknown>
      created_at: string
      updated_at: string
    }>(
      `
        INSERT INTO consents
          (
            owner_user_id,
            viewer_user_id,
            viewer_role,
            resource_type,
            resource_id,
            allowed_fields,
            allowed_purposes,
            can_view_contact,
            valid_from,
            valid_until,
            metadata
          )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (
          owner_user_id,
          viewer_user_id,
          viewer_role,
          resource_type,
          resource_id,
          valid_from
        ) DO UPDATE SET
          allowed_fields = EXCLUDED.allowed_fields,
          allowed_purposes = EXCLUDED.allowed_purposes,
          can_view_contact = EXCLUDED.can_view_contact,
          valid_until = EXCLUDED.valid_until,
          metadata = EXCLUDED.metadata,
          revoked_at = NULL,
          updated_at = NOW()
        RETURNING *
      `,
      [
        user.id,
        payload.viewerUserId ?? null,
        payload.viewerRole ?? null,
        payload.resourceType,
        payload.resourceId ?? null,
        payload.allowedFields,
        payload.allowedPurposes,
        payload.canViewContact,
        payload.validFrom,
        payload.validUntil,
        payload.metadata,
      ],
    )

    const [consent] = rows
    if (!consent) {
      return NextResponse.json({ error: '동의 생성에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ consent }, { status: 201 })
  } catch (error) {
    console.error('Create consent error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '동의 생성 중 오류가 발생했습니다' }, { status: 400 })
  }
}
