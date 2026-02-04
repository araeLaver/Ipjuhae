import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { verifyIdentity, getVerificationProvider } from '@/lib/verification'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const identitySchema = z.object({
  name: z.string().min(2, '이름을 입력해주세요'),
  phoneNumber: z.string().regex(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/, '유효한 휴대폰 번호를 입력해주세요'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD)'),
})

// POST: 본인 인증 (집주인/세입자 공통)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = identitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력 정보를 확인해주세요' },
        { status: 400 }
      )
    }

    const { name, phoneNumber, birthDate } = parsed.data

    // 본인 인증 실행
    const provider = getVerificationProvider()
    const result = await verifyIdentity(name, phoneNumber, birthDate)

    if (!result.success) {
      logger.warn('본인 인증 실패', { userId: user.id, error: result.error })
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // 프로필 업데이트
    const existingProfile = await queryOne<{ id: string }>(
      'SELECT id FROM profiles WHERE user_id = $1',
      [user.id]
    )

    if (existingProfile) {
      await query(
        `UPDATE profiles SET
          name = $1,
          phone = $2,
          birth_date = $3,
          identity_verified = TRUE,
          identity_verified_at = NOW(),
          identity_ci = $4,
          identity_di = $5
        WHERE user_id = $6`,
        [
          result.data?.name || name,
          result.data?.phoneNumber || phoneNumber,
          result.data?.birthDate || birthDate,
          result.data?.ci,
          result.data?.di,
          user.id,
        ]
      )
    } else {
      await query(
        `INSERT INTO profiles (user_id, name, phone, birth_date, identity_verified, identity_verified_at, identity_ci, identity_di)
        VALUES ($1, $2, $3, $4, TRUE, NOW(), $5, $6)`,
        [
          user.id,
          result.data?.name || name,
          result.data?.phoneNumber || phoneNumber,
          result.data?.birthDate || birthDate,
          result.data?.ci,
          result.data?.di,
        ]
      )
    }

    // 사용자 휴대폰 인증 상태도 업데이트
    await query(
      'UPDATE users SET phone_verified = TRUE WHERE id = $1',
      [user.id]
    )

    logger.info('본인 인증 완료', {
      userId: user.id,
      name: result.data?.name,
      provider,
    })

    return NextResponse.json({
      success: true,
      message: '본인 인증이 완료되었습니다',
      verified: true,
      provider,
    })
  } catch (error) {
    logger.error('본인 인증 오류', { error })
    return NextResponse.json({ error: '본인 인증 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// GET: 본인 인증 상태 확인
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const profile = await queryOne<{
      identity_verified: boolean
      identity_verified_at: string | null
      name: string
    }>(
      'SELECT identity_verified, identity_verified_at, name FROM profiles WHERE user_id = $1',
      [user.id]
    )

    return NextResponse.json({
      verified: profile?.identity_verified || false,
      verifiedAt: profile?.identity_verified_at,
      name: profile?.name,
    })
  } catch (error) {
    logger.error('본인 인증 상태 조회 오류', { error })
    return NextResponse.json({ error: '상태 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
