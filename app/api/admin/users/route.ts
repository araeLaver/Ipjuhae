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

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const userType = searchParams.get('type') // 'tenant' | 'landlord' | null (all)
  const search = searchParams.get('q')?.trim()
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)

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

  if (cursor) {
    params.push(cursor)
    conditions.push(`u.created_at < (SELECT created_at FROM users WHERE id = $${params.length}::uuid)`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  params.push(limit + 1)
  const limitParam = `$${params.length}`

  const rows = await query<UserRow>(`
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
  `, params)

  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? data[data.length - 1].id : null

  return NextResponse.json({
    users: data.map(r => ({
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
