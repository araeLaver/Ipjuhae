import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAdminUser } from '@/lib/admin'

interface DocRow {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  document_type: string
  file_name: string
  file_url: string | null
  status: string
  reject_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending' // pending | processing | approved | rejected | all
  const type = searchParams.get('type') ?? 'all'
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)
  const cursor = searchParams.get('cursor')

  const validStatuses = ['pending', 'processing', 'approved', 'rejected', 'all']
  const safeStatus = validStatuses.includes(status) ? status : 'pending'
  const validTypes = ['employment', 'income', 'credit', 'all']
  const safeType = validTypes.includes(type) ? type : 'all'

  function buildFilters(includeStatus: boolean) {
    const conditions: string[] = ['1=1']
    const params: unknown[] = []

    if (includeStatus && safeStatus !== 'all') {
      params.push(safeStatus)
      conditions.push(`vd.status = $${params.length}`)
    }

    if (safeType !== 'all') {
      params.push(safeType)
      conditions.push(`vd.document_type = $${params.length}`)
    }

    if (q) {
      params.push(`%${q}%`)
      const idx = params.length
      conditions.push(`(
        u.email ILIKE $${idx}
        OR COALESCE(u.name, '') ILIKE $${idx}
        OR vd.file_name ILIKE $${idx}
      )`)
    }

    return { conditions, params }
  }

  const listFilters = buildFilters(true)
  if (cursor) {
    listFilters.params.push(cursor, cursor)
    const createdAtIdx = listFilters.params.length - 1
    const idIdx = listFilters.params.length
    listFilters.conditions.push(`(
      vd.created_at < (SELECT created_at FROM verification_documents WHERE id = $${createdAtIdx}::uuid)
      OR (
        vd.created_at = (SELECT created_at FROM verification_documents WHERE id = $${createdAtIdx}::uuid)
        AND vd.id < $${idIdx}::uuid
      )
    )`)
  }

  const whereClause = `WHERE ${listFilters.conditions.join(' AND ')}`

  const listParams = [...listFilters.params, limit + 1]

  const rows = await query<DocRow>(`
    SELECT
      vd.id,
      vd.user_id,
      u.email  AS user_email,
      u.name   AS user_name,
      vd.document_type,
      vd.file_name,
      vd.file_url,
      vd.status,
      vd.reject_reason,
      vd.reviewed_by::text,
      vd.reviewed_at::text,
      vd.created_at::text
    FROM verification_documents vd
    JOIN users u ON u.id = vd.user_id
    ${whereClause}
    ORDER BY vd.created_at DESC
    LIMIT $${listParams.length}
  `, listParams)

  const countFilters = buildFilters(false)
  const countWhereClause = `WHERE ${countFilters.conditions.join(' AND ')}`

  const counts = await queryOne<{
    pending: string
    processing: string
    approved: string
    rejected: string
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE vd.status = 'pending')::text AS pending,
      COUNT(*) FILTER (WHERE vd.status = 'processing')::text AS processing,
      COUNT(*) FILTER (WHERE vd.status = 'approved')::text AS approved,
      COUNT(*) FILTER (WHERE vd.status = 'rejected')::text AS rejected
    FROM verification_documents vd
    JOIN users u ON u.id = vd.user_id
    ${countWhereClause}
  `, countFilters.params)

  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows

  return NextResponse.json({
    documents: data,
    nextCursor: hasMore ? data[data.length - 1].id : null,
    counts: {
      pending: Number(counts?.pending ?? 0),
      processing: Number(counts?.processing ?? 0),
      approved: Number(counts?.approved ?? 0),
      rejected: Number(counts?.rejected ?? 0),
    },
  })
}
