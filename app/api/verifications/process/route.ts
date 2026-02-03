import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { VerificationDocument, Verification } from '@/types/database'

// POST: Mock 서류 처리 (상태 전이: pending → processing → approved/rejected)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: '서류 ID가 필요합니다' }, { status: 400 })
    }

    const doc = await queryOne<VerificationDocument>(
      'SELECT * FROM verification_documents WHERE id = $1 AND user_id = $2',
      [documentId, user.id]
    )

    if (!doc) {
      return NextResponse.json({ error: '서류를 찾을 수 없습니다' }, { status: 404 })
    }

    // 상태 전이 로직
    if (doc.status === 'pending') {
      // pending → processing
      await query(
        "UPDATE verification_documents SET status = 'processing', updated_at = NOW() WHERE id = $1",
        [documentId]
      )
      return NextResponse.json({ status: 'processing', message: '서류 검토를 시작합니다' })
    }

    if (doc.status === 'processing') {
      // processing → approved (90% 확률) or rejected
      const approved = Math.random() < 0.9
      const newStatus = approved ? 'approved' : 'rejected'
      const rejectReason = approved ? null : '서류가 불명확합니다. 다시 제출해주세요.'

      await query(
        'UPDATE verification_documents SET status = $1, reject_reason = $2, updated_at = NOW() WHERE id = $3',
        [newStatus, rejectReason, documentId]
      )

      // 승인 시 verifications 테이블도 업데이트
      if (approved) {
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

        const fieldMap: Record<string, string> = {
          employment: 'employment_verified = TRUE, employment_verified_at = NOW()',
          income: 'income_verified = TRUE, income_verified_at = NOW()',
          credit: 'credit_verified = TRUE, credit_verified_at = NOW()',
        }

        const setClause = fieldMap[doc.document_type]
        if (setClause) {
          await query(
            `UPDATE verifications SET ${setClause} WHERE user_id = $1`,
            [user.id]
          )
        }
      }

      return NextResponse.json({
        status: newStatus,
        rejectReason,
        message: approved ? '서류가 승인되었습니다' : '서류가 반려되었습니다',
      })
    }

    return NextResponse.json({ status: doc.status, message: '이미 처리된 서류입니다' })
  } catch (error) {
    console.error('Process verification error:', error)
    return NextResponse.json({ error: '서류 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
