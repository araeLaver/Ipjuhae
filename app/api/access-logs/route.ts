import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

const VALID_TARGET_TYPES = ['profile', 'reference', 'document', 'property', 'trade_hint', 'admin_check'] as const

function parseLimit(value: string | null, fallback = 50): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 200)
}

function parseOffset(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(Math.trunc(parsed), 0)
}

function parseTargetType(raw: string | null): (typeof VALID_TARGET_TYPES)[number] | null {
  if (!raw) return null
  return (VALID_TARGET_TYPES as readonly string[]).includes(raw)
    ? (raw as (typeof VALID_TARGET_TYPES)[number])
    : null
}

function parseDirection(raw: string | null): 'received' | 'viewed' | 'both' {
  return raw === 'received' || raw === 'viewed' ? raw : 'both'
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const targetType = parseTargetType(searchParams.get('targetType'))
    const direction = parseDirection(searchParams.get('direction'))
    const viewerUserId = searchParams.get('viewerUserId')
    const ownerUserId = searchParams.get('ownerUserId')
    const targetId = searchParams.get('targetId')
    const targetPropertyId = searchParams.get('targetPropertyId')
    const result = searchParams.get('result')
    const limit = parseLimit(searchParams.get('limit'), 100)
    const offset = parseOffset(searchParams.get('offset'))

    if (user.user_type !== 'admin') {
      if (viewerUserId && viewerUserId !== user.id) {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
      }

      if (ownerUserId && ownerUserId !== user.id) {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
      }
    }

    const whereSql: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (user.user_type === 'admin') {
      if (viewerUserId) {
        whereSql.push(`viewer_user_id = $${idx}`)
        values.push(viewerUserId)
        idx += 1
      }

      if (ownerUserId) {
        whereSql.push(`owner_user_id = $${idx}`)
        values.push(ownerUserId)
        idx += 1
      }
    } else if (direction === 'viewed') {
      whereSql.push(`viewer_user_id = $${idx}`)
      values.push(user.id)
      idx += 1
    } else if (direction === 'received') {
      whereSql.push(`owner_user_id = $${idx}`)
      values.push(user.id)
      idx += 1
    } else {
      whereSql.push(`(viewer_user_id = $${idx} OR owner_user_id = $${idx})`)
      values.push(user.id)
      idx += 1
    }

    if (targetType) {
      whereSql.push(`target_type = $${idx}`)
      values.push(targetType)
      idx += 1
    }

    if (targetId) {
      whereSql.push(`target_id = $${idx}`)
      values.push(targetId)
      idx += 1
    }

    if (targetPropertyId) {
      whereSql.push(`target_property_id = $${idx}`)
      values.push(targetPropertyId)
      idx += 1
    }

    if (result) {
      whereSql.push(`result = $${idx}`)
      values.push(result)
      idx += 1
    }

    const whereClause = whereSql.length > 0 ? `WHERE ${whereSql.join(' AND ')}` : ''

    values.push(limit, offset)
    const limitIdx = idx
    const offsetIdx = idx + 1

    const rows = await query(
      `SELECT *
       FROM access_logs
       ${whereClause}
       ORDER BY viewed_at DESC
       LIMIT $${limitIdx}
       OFFSET $${offsetIdx}`,
      values,
    )

    return NextResponse.json({ accessLogs: rows })
  } catch (error) {
    console.error('Get access logs error:', error)
    return NextResponse.json({ error: '열람 로그 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
