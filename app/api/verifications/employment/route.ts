import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { Verification } from '@/types/database'
import { employmentSchema } from '@/lib/validations'
import { verifyEmployment, getVerificationProvider } from '@/lib/verification'
import { logger } from '@/lib/logger'

// POST: 재직 인증
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = employmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '회사명을 입력해주세요' },
        { status: 400 }
      )
    }

    const { company } = parsed.data

    // 실서비스 연동 시 본인인증 정보 필요
    const provider = getVerificationProvider()
    let userIdentity: { name: string; birthDate: string; phoneNumber: string } | undefined

    if (provider !== 'mock') {
      // 프로필에서 본인인증 정보 조회
      const profile = await queryOne<{ name: string; birth_date: string; phone: string }>(
        'SELECT name, birth_date, phone FROM profiles WHERE user_id = $1',
        [user.id]
      )

      if (!profile?.phone) {
        return NextResponse.json(
          { error: '재직 인증을 위해 먼저 휴대폰 인증을 완료해주세요' },
          { status: 400 }
        )
      }

      userIdentity = {
        name: profile.name,
        birthDate: profile.birth_date,
        phoneNumber: profile.phone,
      }
    }

    // 재직 인증 실행
    const result = await verifyEmployment(company, userIdentity)

    if (!result.success) {
      logger.warn('재직 인증 실패', { userId: user.id, error: result.error })
      return NextResponse.json({ error: result.error }, { status: 400 })
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

    // 인증 결과 저장
    const [updated] = await query<Verification>(
      `UPDATE verifications SET
        employment_verified = TRUE,
        employment_company = $1,
        employment_verified_at = NOW()
      WHERE user_id = $2
      RETURNING *`,
      [result.data?.company || company.trim(), user.id]
    )

    logger.info('재직 인증 완료', { userId: user.id, company: result.data?.company })

    return NextResponse.json({
      verification: updated,
      message: '재직 인증이 완료되었습니다',
      provider,
    })
  } catch (error) {
    logger.error('재직 인증 오류', { error })
    return NextResponse.json({ error: '재직 인증 중 오류가 발생했습니다' }, { status: 500 })
  }
}
