import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { PhoneVerification } from '@/types/database'

export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber || !/^01[016789]\d{7,8}$/.test(phoneNumber)) {
      return NextResponse.json({ error: '올바른 휴대폰 번호를 입력해주세요' }, { status: 400 })
    }

    // 6자리 인증번호 생성
    const code = String(Math.floor(100000 + Math.random() * 900000))

    // 3분 후 만료
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString()

    // 기존 미인증 코드 삭제
    await query(
      'DELETE FROM phone_verifications WHERE phone_number = $1 AND verified = FALSE',
      [phoneNumber]
    )

    // 새 코드 저장
    await query<PhoneVerification>(
      'INSERT INTO phone_verifications (phone_number, code, expires_at) VALUES ($1, $2, $3)',
      [phoneNumber, code, expiresAt]
    )

    // Mock: 실제 SMS 발송 대신 콘솔 출력 + 응답에 코드 포함 (개발용)
    console.log(`[Mock SMS] ${phoneNumber}: 인증번호 ${code}`)

    return NextResponse.json({
      success: true,
      message: '인증번호가 발송되었습니다',
      code: process.env.NODE_ENV !== 'production' ? code : undefined,
    })
  } catch (error) {
    console.error('Phone send error:', error)
    return NextResponse.json({ error: '인증번호 발송 중 오류가 발생했습니다' }, { status: 500 })
  }
}
