import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getAdminUser, logAdminAction } from '@/lib/admin'
import { notifyVerificationApproved, notifyVerificationRejected } from '@/lib/notifications'
import { calculateTrustScore, completeExtractionJob, createEvidenceFact, trustDigest, type TrustSubjectType } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'

interface DocRow {
  id: string
  user_id: string
  document_type: string
  status: string
  user_type: string
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
    `SELECT document.id, document.user_id, document.document_type, document.status, users.user_type
       FROM verification_documents document
       JOIN users ON users.id = document.user_id
      WHERE document.id = $1`,
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
  if (newStatus === 'approved') {
    const typeMap: Record<string, string> = {
      employment: 'employment_verified',
      income: 'income_verified',
      credit: 'credit_verified',
    }
    const col = typeMap[doc.document_type]
    if (col) {
      // upsert verifications row
      await query(
        `INSERT INTO verifications (user_id, ${col}, ${col.replace('verified', 'verified_at')})
         VALUES ($1, TRUE, NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET ${col} = TRUE,
               ${col.replace('verified', 'verified_at')} = NOW(),
               updated_at = NOW()`,
        [doc.user_id]
      )

      const subjectType: TrustSubjectType = doc.user_type === 'landlord' ? 'landlord' : 'tenant'
      const factField = `${doc.document_type}_verified`
      const extractionJob = await queryOne<{ id: string }>(
        `SELECT id FROM trust_extraction_jobs WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [doc.id]
      )
      const trace = getRequestContext(req)
      if (extractionJob) {
        await completeExtractionJob(extractionJob.id, admin.id, [{
          fieldName: factField,
          normalizedValue: true,
          confidence: 1,
          reasonCodes: ['ADMIN_APPROVED_DOCUMENT'],
        }], trace)
      } else {
        await createEvidenceFact({
          subjectType,
          subjectId: doc.user_id,
          sourceCode: 'human_review',
          fieldName: factField,
          normalizedValue: true,
          objectHash: trustDigest({ documentId: doc.id, status: 'approved' }),
          humanReviewed: true,
          reasonCodes: ['ADMIN_APPROVED_DOCUMENT'],
          metadata: { verification_document_id: doc.id },
        }, admin.id, trace)
      }
      await calculateTrustScore(subjectType, doc.user_id, admin.id, trace)
    }
  }

  if (newStatus === 'approved') {
    notifyVerificationApproved({ toUserId: doc.user_id, documentType: doc.document_type }).catch(() => {})
  } else if (newStatus === 'rejected') {
    notifyVerificationRejected({ toUserId: doc.user_id, documentType: doc.document_type, reason: body.reject_reason }).catch(() => {})
  }

  await logAdminAction(admin.id, `${body.action}_document`, 'document', id, {
    document_type: doc.document_type,
    reject_reason: body.reject_reason,
  })

  return NextResponse.json({ ok: true, status: newStatus })
}
