import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { LandlordReference, Profile } from '@/types/database'
import { sendReferenceRequestSMS } from '@/lib/sms'
import { referenceRequestSchema } from '@/lib/validations'
import crypto from 'crypto'

// GET: 내 레퍼런스 목록
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const references = await query<LandlordReference>(
      `SELECT * FROM landlord_references WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id]
    )

    return NextResponse.json({ references })
  } catch (error) {
    console.error('Get references error:', error)
    return NextResponse.json({ error: '레퍼런스 목록 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST: 레퍼런스 요청 생성
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = referenceRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다' },
        { status: 400 }
      )
    }

    const { landlordName, landlordPhone, landlordEmail } = parsed.data

    const existingRequest = await queryOne<LandlordReference>(
      `SELECT * FROM landlord_references
       WHERE user_id = $1 AND landlord_phone = $2 AND status IN ('pending', 'sent')`,
      [user.id, landlordPhone]
    )

    if (existingRequest) {
      return NextResponse.json({ error: '이미 해당 연락처로 요청이 진행 중입니다' }, { status: 400 })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const [reference] = await query<LandlordReference>(
      `INSERT INTO landlord_references
        (user_id, landlord_name, landlord_phone, landlord_email, verification_token, token_expires_at, status, request_sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent', NOW())
       RETURNING *`,
      [user.id, landlordName, landlordPhone, landlordEmail, token, expiresAt]
    )

    const profile = await queryOne<Profile>(
      'SELECT name FROM profiles WHERE user_id = $1',
      [user.id]
    )

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const surveyUrl = `${baseUrl}/reference/survey/${token}`

    await sendReferenceRequestSMS(
      landlordPhone,
      profile?.name || '세입자',
      surveyUrl
    )

    const response: Record<string, unknown> = {
      reference,
      message: '레퍼런스 요청이 전송되었습니다',
    }

    // 개발 환경에서만 surveyUrl 반환
    if (process.env.NODE_ENV !== 'production') {
      response.surveyUrl = surveyUrl
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Create reference error:', error)
    return NextResponse.json({ error: '레퍼런스 요청 중 오류가 발생했습니다' }, { status: 500 })
  }
}
