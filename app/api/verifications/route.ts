import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { Verification } from '@/types/database'

// GET: 현재 사용자 인증 상태 조회
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    let verification = await queryOne<Verification>(
      'SELECT * FROM verifications WHERE user_id = $1',
      [user.id]
    )

    // 인증 레코드가 없으면 생성
    if (!verification) {
      const [created] = await query<Verification>(
        'INSERT INTO verifications (user_id) VALUES ($1) RETURNING *',
        [user.id]
      )
      verification = created
    }

    return NextResponse.json({ verification })
  } catch (error) {
    console.error('Get verification error:', error)
    return NextResponse.json({ error: '인증 정보 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
