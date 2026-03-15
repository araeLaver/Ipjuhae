import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAdminUser } from '@/lib/admin'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

// POST /api/admin/waitlist/invite — 대기자 초대 발송
export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { ids, count } = body as { ids?: number[]; count?: number }

    let targetRows: Array<{ id: number; email: string; user_type: string }>

    if (ids && ids.length > 0) {
      // 특정 ID 선택 초대
      targetRows = await query<{ id: number; email: string; user_type: string }>(
        `SELECT id, email, user_type FROM waitlist
         WHERE id = ANY($1) AND invited_at IS NULL`,
        [ids]
      )
    } else {
      // 선착순 N명 초대
      const inviteCount = Math.min(count || 10, 100)
      targetRows = await query<{ id: number; email: string; user_type: string }>(
        `SELECT id, email, user_type FROM waitlist
         WHERE invited_at IS NULL
         ORDER BY created_at ASC
         LIMIT $1`,
        [inviteCount]
      )
    }

    if (targetRows.length === 0) {
      return NextResponse.json({ message: '초대할 대기자가 없습니다', invited: 0 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.ipjuhae.com'
    let successCount = 0
    const errors: string[] = []

    for (const row of targetRows) {
      const token = crypto.randomBytes(32).toString('hex')
      const inviteUrl = `${baseUrl}/invite/${token}`

      await query(
        `UPDATE waitlist SET invite_token = $1, invited_at = NOW() WHERE id = $2`,
        [token, row.id]
      )

      const result = await sendEmail({
        to: row.email,
        subject: '[입주해] 베타 서비스에 초대되었습니다!',
        html: buildInviteEmailHtml(inviteUrl, row.user_type),
        text: `입주해 베타 서비스에 초대되었습니다! 아래 링크로 가입하세요: ${inviteUrl}`,
      })

      if (result.success) {
        successCount++
      } else {
        errors.push(`${row.email}: ${result.error}`)
      }
    }

    return NextResponse.json({
      message: `${successCount}명 초대 완료`,
      invited: successCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[admin/waitlist/invite POST]', error)
    return NextResponse.json({ error: '초대 처리 실패' }, { status: 500 })
  }
}

function buildInviteEmailHtml(inviteUrl: string, userType: string): string {
  const typeLabel = userType === 'landlord' ? '집주인' : '세입자'
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #2563eb; margin-bottom: 8px;">입주해 베타 초대장</h1>
      <p style="color: #6b7280; font-size: 14px;">신뢰 기반 주거 매칭 플랫폼</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p>안녕하세요!</p>
      <p>
        ${typeLabel}으로 대기 신청해 주셔서 감사합니다.
        입주해 베타 서비스에 초대되었습니다!
      </p>
      <p>아래 버튼을 클릭하여 회원가입을 완료해 주세요.</p>
      <a href="${inviteUrl}"
         style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px;">
        베타 서비스 가입하기
      </a>
      <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
        베타 기간 동안 모든 프리미엄 기능을 무료로 이용하실 수 있습니다.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        이 이메일은 입주해 대기자 명단에 등록하신 분께 발송되었습니다.
      </p>
    </div>
  `
}
