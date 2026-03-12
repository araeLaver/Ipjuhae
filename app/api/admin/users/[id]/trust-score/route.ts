import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAdminUser, logAdminAction } from '@/lib/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as { score?: number; reason?: string }

  if (typeof body.score !== 'number' || body.score < 0 || body.score > 100) {
    return NextResponse.json({ error: 'score는 0~100 사이 숫자여야 합니다' }, { status: 400 })
  }

  const updated = await query(
    `UPDATE profiles
     SET trust_score = $1, updated_at = NOW()
     WHERE user_id = $2
     RETURNING trust_score`,
    [body.score, id]
  )

  if (updated.length === 0) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
  }

  await logAdminAction(admin.id, 'adjust_trust_score', 'user', id, {
    score: body.score,
    reason: body.reason ?? null,
  })

  return NextResponse.json({ ok: true, trustScore: body.score })
}
