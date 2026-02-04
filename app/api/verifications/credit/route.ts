import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { Verification } from '@/types/database'
import { verifyCredit, getVerificationProvider } from '@/lib/verification'
import { logger } from '@/lib/logger'

// POST: 신용 인증
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { documentId } = body

    // 서류 기반 인증 (문서 승인 확인)
    if (documentId) {
      const doc = await queryOne<{ id: string; status: string }>(
        "SELECT id, status FROM verification_documents WHERE id = $1 AND user_id = $2 AND document_type = 'credit'",
        [documentId, user.id]
      )
      if (!doc) {
        return NextResponse.json({ error: '서류를 찾을 수 없습니다' }, { status: 404 })
      }
      if (doc.status !== 'approved') {
        return NextResponse.json(
          { error: '서류가 아직 승인되지 않았습니다', status: doc.status },
          { status: 400 }
        )
      }
    }

    // 실서비스 연동 시 본인인증 정보 필요
    const provider = getVerificationProvider()
    let userIdentity: { name: string; birthDate: string; phoneNumber: string } | undefined

    if (provider !== 'mock') {
      const profile = await queryOne<{ name: string; birth_date: string; phone: string }>(
        'SELECT name, birth_date, phone FROM profiles WHERE user_id = $1',
        [user.id]
      )

      if (!profile?.phone) {
        return NextResponse.json(
          { error: '신용 인증을 위해 먼저 휴대폰 인증을 완료해주세요' },
          { status: 400 }
        )
      }

      userIdentity = {
        name: profile.name,
        birthDate: profile.birth_date,
        phoneNumber: profile.phone,
      }
    }

    // 신용 인증 실행
    const result = await verifyCredit(userIdentity)

    if (!result.success) {
      logger.warn('신용 인증 실패', { userId: user.id, error: result.error })
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

    // 신용 인증 업데이트
    const [updated] = await query<Verification>(
      `UPDATE verifications SET
        credit_verified = TRUE,
        credit_grade = $1,
        credit_verified_at = NOW()
      WHERE user_id = $2
      RETURNING *`,
      [result.data?.creditGrade, user.id]
    )

    logger.info('신용 인증 완료', {
      userId: user.id,
      creditGrade: result.data?.creditGrade,
      gradeLabel: result.data?.gradeLabel,
    })

    return NextResponse.json({
      verification: updated,
      message: `신용 인증이 완료되었습니다. 등급: ${result.data?.gradeLabel}`,
      creditInfo: {
        grade: result.data?.creditGrade,
        label: result.data?.gradeLabel,
        score: result.data?.creditScore,
      },
      provider,
    })
  } catch (error) {
    logger.error('신용 인증 오류', { error })
    return NextResponse.json({ error: '신용 인증 중 오류가 발생했습니다' }, { status: 500 })
  }
}
