import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
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
  created_at: string
}

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending' // pending | processing | approved | rejected
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)
  const cursor = searchParams.get('cursor')

  const validStatuses = ['pending', 'processing', 'approved', 'rejected']
  const safeStatus = validStatuses.includes(status) ? status : 'pending'

  const params: unknown[] = [safeStatus]
  let cursorClause = ''
  if (cursor) {
    params.push(cursor)
    cursorClause = `AND vd.created_at < (SELECT created_at FROM verification_documents WHERE id = $${params.length}::uuid)`
  }
  params.push(limit + 1)

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
      vd.created_at::text
    FROM verification_documents vd
    JOIN users u ON u.id = vd.user_id
    WHERE vd.status = $1
    ${cursorClause}
    ORDER BY vd.created_at DESC
    LIMIT $${params.length}
  `, params)

  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows

  return NextResponse.json({
    documents: data,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  })
}
