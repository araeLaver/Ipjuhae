import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAdminUser } from '@/lib/admin'

interface UserRow {
  id: string
  email: string
  name: string | null
  user_type: string
  created_at: string
  trust_score: string | null
  is_complete: boolean | null
  profile_id: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '30', 10)
  if (!Number.isFinite(parsed)) return 30
  return Math.max(1, Math.min(parsed, 100))
}

function parseCursor(cursor: string | null): {
  createdAt?: string
  id?: string
  legacyId?: string
  isLegacy: boolean
} {
  if (!cursor) return { isLegacy: false }
  const [rawCreatedAt, rawId] = cursor.split('|')

  if (rawCreatedAt && rawId && UUID_PATTERN.test(rawId)) {
    try {
      return { isLegacy: false, createdAt: decodeURIComponent(rawCreatedAt), id: rawId }
    } catch {
      return { isLegacy: false }
    }
  }

  if (UUID_PATTERN.test(cursor)) {
    return { isLegacy: true, legacyId: cursor }
  }

  return { isLegacy: false }
}

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const userType = searchParams.get('type')
  const search = searchParams.get('q')?.trim()
  const parsedCursor = parseCursor(searchParams.get('cursor'))
  const limit = parseLimit(searchParams.get('limit'))

  if (searchParams.get('cursor') && !parsedCursor.isLegacy && !parsedCursor.createdAt && !parsedCursor.id) {
    return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
  }

  const conditions: string[] = ["u.user_type != 'admin'"]
  const params: unknown[] = []

  if (userType === 'tenant' || userType === 'landlord') {
    params.push(userType)
    conditions.push(`u.user_type = $${params.length}`)
  }

  if (search) {
    params.push(`%${search}%`)
    conditions.push(`(u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`)
  }

  if (parsedCursor.isLegacy && parsedCursor.legacyId) {
    params.push(parsedCursor.legacyId)
    conditions.push(`u.created_at < (SELECT created_at FROM users WHERE id = $${params.length}::uuid)`)
  } else if (parsedCursor.createdAt && parsedCursor.id) {
    params.push(parsedCursor.createdAt)
    params.push(parsedCursor.id)
    conditions.push(
      `(u.created_at < $${params.length - 1}::timestamptz OR (u.created_at = $${params.length - 1}::timestamptz AND u.id < $${params.length}))`
    )
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  params.push(limit + 1)
  const limitParam = `$${params.length}`

  const rows = await query<UserRow>(
    `
    SELECT
      u.id,
      u.email,
      u.name,
      u.user_type,
      u.created_at::text,
      p.trust_score::text,
      p.is_complete,
      p.id AS profile_id
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ${limitParam}
  `,
    params
  )

  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore
    ? `${encodeURIComponent(data[data.length - 1].created_at)}|${data[data.length - 1].id}`
    : null

  return NextResponse.json({
    users: data.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      userType: r.user_type,
      createdAt: r.created_at,
      trustScore: r.trust_score ? parseInt(r.trust_score) : null,
      isComplete: r.is_complete ?? false,
      profileId: r.profile_id,
    })),
    nextCursor,
  })
}
