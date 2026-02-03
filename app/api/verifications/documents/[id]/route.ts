import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { VerificationDocument } from '@/types/database'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params

    const doc = await queryOne<VerificationDocument>(
      'SELECT * FROM verification_documents WHERE id = $1 AND user_id = $2',
      [id, user.id]
    )

    if (!doc) {
      return NextResponse.json({ error: '서류를 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json(doc)
  } catch (error) {
    console.error('Document status error:', error)
    return NextResponse.json({ error: '서류 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
