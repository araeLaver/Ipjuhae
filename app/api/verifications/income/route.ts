import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { Verification } from '@/types/database'
import { incomeSchema } from '@/lib/validations'

// POST: 소득 인증 (Mock)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = incomeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '유효한 소득 구간을 선택해주세요' },
        { status: 400 }
      )
    }

    const { incomeRange } = parsed.data

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

    const [updated] = await query<Verification>(
      `UPDATE verifications SET
        income_verified = TRUE,
        income_range = $1,
        income_verified_at = NOW()
      WHERE user_id = $2
      RETURNING *`,
      [incomeRange, user.id]
    )

    return NextResponse.json({
      verification: updated,
      message: '소득 인증이 완료되었습니다'
    })
  } catch (error) {
    console.error('Income verification error:', error)
    return NextResponse.json({ error: '소득 인증 중 오류가 발생했습니다' }, { status: 500 })
  }
}
