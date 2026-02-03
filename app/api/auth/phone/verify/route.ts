import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { PhoneVerification } from '@/types/database'

export async function POST(request: Request) {
  try {
    const { phoneNumber, code } = await request.json()

    if (!phoneNumber || !code) {
      return NextResponse.json({ error: '전화번호와 인증번호를 입력해주세요' }, { status: 400 })
    }

    const record = await queryOne<PhoneVerification>(
      `SELECT * FROM phone_verifications
       WHERE phone_number = $1 AND code = $2 AND verified = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phoneNumber, code]
    )

    if (!record) {
      return NextResponse.json({ error: '인증번호가 올바르지 않거나 만료되었습니다' }, { status: 400 })
    }

    // 인증 완료 처리
    await query(
      'UPDATE phone_verifications SET verified = TRUE WHERE id = $1',
      [record.id]
    )

    // 로그인 상태면 유저 정보 업데이트
    const user = await getCurrentUser()
    if (user) {
      await query(
        'UPDATE users SET phone_number = $1, phone_verified = TRUE WHERE id = $2',
        [phoneNumber, user.id]
      )
    }

    return NextResponse.json({ success: true, message: '인증이 완료되었습니다' })
  } catch (error) {
    console.error('Phone verify error:', error)
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다' }, { status: 500 })
  }
}
