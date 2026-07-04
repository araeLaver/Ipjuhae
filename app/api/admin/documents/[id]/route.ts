import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAdminUser, logAdminAction } from '@/lib/admin'
import { notifyVerificationApproved, notifyVerificationRejected } from '@/lib/notifications'
import { recalculateTrustScoreForUser } from '@/lib/trust-score-recalculator'

interface DocRow {
  id: string
  user_id: string
  document_type: string
  status: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as {
    action: 'approve' | 'reject' | 'processing'
    reject_reason?: string
  }

  if (!['approve', 'reject', 'processing'].includes(body.action)) {
    return NextResponse.json({ error: '유효하지 않은 action' }, { status: 400 })
  }

  if (body.action === 'reject' && !body.reject_reason?.trim()) {
    return NextResponse.json({ error: '거절 사유를 입력해주세요' }, { status: 400 })
  }

  const doc = await queryOne<DocRow>(
    'SELECT id, user_id, document_type, status FROM verification_documents WHERE id = $1',
    [id]
  )

  if (!doc) {
    return NextResponse.json({ error: '서류를 찾을 수 없습니다' }, { status: 404 })
  }

  const newStatus =
    body.action === 'approve' ? 'approved' :
    body.action === 'reject' ? 'rejected' : 'processing'

  await query(
    `UPDATE verification_documents
     SET status       = $1,
         reject_reason = $2,
         reviewed_by  = $3,
         reviewed_at  = NOW(),
         updated_at   = NOW()
     WHERE id = $4`,
    [newStatus, body.reject_reason ?? null, admin.id, id]
  )

  // 승인 시 verifications 테이블 업데이트
  const typeMap: Record<string, string> = {
    employment: 'employment_verified',
    income: 'income_verified',
    credit: 'credit_verified',
  }
  const col = typeMap[doc.document_type]
  const wasApproved = doc.status === 'approved'
  const nowApproved = newStatus === 'approved'

  // 승인 상태가 변경되면 verifications 테이블 반영
  if (nowApproved && !wasApproved && col) {
    await query(
      `INSERT INTO verifications (user_id, ${col}, ${col.replace('verified', 'verified_at')})
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET ${col} = TRUE,
             ${col.replace('verified', 'verified_at')} = NOW(),
             updated_at = NOW()`,
      [doc.user_id],
    )
  }

  // 승인 해제(거절/대기)로 내려온 경우 점검 데이터는 별도 비검증 처리
  if (wasApproved && !nowApproved && col) {
    await query(
      `UPDATE verifications
       SET ${col} = FALSE,
           ${col.replace('verified', 'verified_at')} = NULL,
           updated_at = NOW()
       WHERE user_id = $1`,
      [doc.user_id],
    )
  }

  if (newStatus === 'approved') {
    notifyVerificationApproved({ toUserId: doc.user_id, documentType: doc.document_type }).catch(() => {})
  } else if (newStatus === 'rejected') {
    notifyVerificationRejected({ toUserId: doc.user_id, documentType: doc.document_type, reason: body.reject_reason }).catch(() => {})
  }

  if (col) {
    recalculateTrustScoreForUser(doc.user_id).catch(() => {})
  }

  await logAdminAction(admin.id, `${body.action}_document`, 'document', id, {
    document_type: doc.document_type,
    reject_reason: body.reject_reason,
  })

  return NextResponse.json({ ok: true, status: newStatus })
}
