/**
 * POST /api/references/[id]/resend
 * 만료된 레퍼런스 재발송 — 새 토큰 발급 + SMS 재전송
 */
import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { LandlordReference, Profile } from '@/types/database'
import { sendReferenceRequestSMS } from '@/lib/sms'
import crypto from 'crypto'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { id } = await params

    const reference = await queryOne<LandlordReference>(
      'SELECT * FROM landlord_references WHERE id = $1 AND user_id = $2',
      [id, user.id]
    )

    if (!reference) {
      return NextResponse.json({ error: '레퍼런스를 찾을 수 없습니다' }, { status: 404 })
    }

    if (reference.status === 'completed') {
      return NextResponse.json({ error: '이미 완료된 레퍼런스는 재발송할 수 없습니다' }, { status: 400 })
    }

    if (reference.status === 'sent') {
      return NextResponse.json({ error: '아직 유효한 요청입니다. 만료 후 재발송하세요' }, { status: 400 })
    }

    // 새 토큰 발급
    const newToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const [updated] = await query<LandlordReference>(
      `UPDATE landlord_references
       SET verification_token = $1,
           token_expires_at   = $2,
           status             = 'sent',
           request_sent_at    = NOW(),
           updated_at         = NOW()
       WHERE id = $3
       RETURNING *`,
      [newToken, expiresAt, id]
    )

    const profile = await queryOne<Profile>(
      'SELECT name FROM profiles WHERE user_id = $1',
      [user.id]
    )

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const surveyUrl = `${baseUrl}/reference/survey/${newToken}`

    await sendReferenceRequestSMS(
      reference.landlord_phone,
      profile?.name || '세입자',
      surveyUrl
    )

    return NextResponse.json({
      reference: updated,
      message: '레퍼런스 요청이 재발송되었습니다',
      ...(process.env.NODE_ENV !== 'production' && { surveyUrl }),
    })
  } catch (error) {
    console.error('Resend reference error:', error)
    return NextResponse.json({ error: '재발송 중 오류가 발생했습니다' }, { status: 500 })
  }
}
