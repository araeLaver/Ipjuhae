import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAdminUser } from '@/lib/admin'

// GET /api/admin/feature-requests — 접수된 기능 요구사항 목록 (최신순)
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  try {
    const rows = await query(
      `SELECT id, message, contact, user_type, source, created_at
         FROM feature_requests
        ORDER BY created_at DESC
        LIMIT 200`
    )
    return NextResponse.json({ requests: rows })
  } catch (error) {
    logger.error('[admin feature-requests GET]', { error })
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
