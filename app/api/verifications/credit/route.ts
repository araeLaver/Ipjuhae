import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { Verification } from '@/types/database'

// POST: 신용 인증 (Mock - 등급 1-3 무작위)
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 기존 인증 레코드 확인/생성
    let verification = await queryOne<Verification>(
      'SELECT * FROM verifications WHERE user_id = $1',
      [user.id]
    )

    if (!verification) {
      const [created] = await query<Verification>(
        'INSERT INTO verifications (user_id) VALUES ($1) RETURNING *',
        [user.id]
      )
      verification = created
    }

    // 무작위 신용 등급 생성 (1-3)
    const creditGrade = Math.floor(Math.random() * 3) + 1

    // 신용 인증 업데이트
    const [updated] = await query<Verification>(
      `UPDATE verifications SET
        credit_verified = TRUE,
        credit_grade = $1,
        credit_verified_at = NOW()
      WHERE user_id = $2
      RETURNING *`,
      [creditGrade, user.id]
    )

    const gradeLabels: Record<number, string> = {
      1: '최우량',
      2: '양호',
      3: '보통'
    }

    return NextResponse.json({
      verification: updated,
      message: `신용 인증이 완료되었습니다. 등급: ${gradeLabels[creditGrade]}`
    })
  } catch (error) {
    console.error('Credit verification error:', error)
    return NextResponse.json({ error: '신용 인증 중 오류가 발생했습니다' }, { status: 500 })
  }
}
