import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { sanitizeTag } from '@/lib/attribution'

const WAITLIST_CONSENT_VERSION = 'waitlist-v3-20260905'

const VALID_USER_TYPES = ['tenant', 'landlord', 'agent'] as const

// GET /api/waitlist — 전체 대기자 수 반환
export async function GET() {
  try {
    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM waitlist'
    )
    return NextResponse.json({ count: parseInt(result?.count ?? '0', 10) })
  } catch (error) {
    logger.error('[waitlist GET]', { error })
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST /api/waitlist — 사전 신청 등록 (전화번호 필수, 이메일 선택)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, email, user_type, name, consent } = body as {
      phone?: string
      email?: string
      user_type?: string
      name?: string
      consent?: boolean
    }

    // 유입 경로. 값이 이상하면 조용히 버린다 — 신청 자체를 막을 이유는 없다.
    const attribution = body as Record<string, unknown>
    const utmSource = sanitizeTag(attribution.utm_source as string | undefined)
    const utmMedium = sanitizeTag(attribution.utm_medium as string | undefined)
    const utmCampaign = sanitizeTag(attribution.utm_campaign as string | undefined)
    const referrerHost = sanitizeTag(attribution.referrer_host as string | undefined)

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: '전화번호를 입력해주세요' }, { status: 400 })
    }

    const normalizedPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01[016789][0-9]{7,8}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: '올바른 휴대폰 번호 형식이 아닙니다' }, { status: 400 })
    }

    let normalizedEmail: string | null = null
    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다' }, { status: 400 })
      }
      normalizedEmail = email.toLowerCase().trim()
    }

    if (!user_type || !VALID_USER_TYPES.includes(user_type as (typeof VALID_USER_TYPES)[number])) {
      return NextResponse.json({ error: '사용자 유형을 선택해주세요' }, { status: 400 })
    }

    if (consent !== true) {
      return NextResponse.json(
        { error: '개인정보 수집·이용에 동의해주세요' },
        { status: 400 }
      )
    }

    const trimmedName = typeof name === 'string' ? name.trim().slice(0, 50) : null

    await query(
      `INSERT INTO waitlist
         (phone, email, user_type, name, consent_at, consent_version,
          utm_source, utm_medium, utm_campaign, referrer_host)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9)`,
      [
        normalizedPhone,
        normalizedEmail,
        user_type,
        trimmedName || null,
        WAITLIST_CONSENT_VERSION,
        utmSource,
        utmMedium,
        utmCampaign,
        referrerHost,
      ]
    )

    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM waitlist'
    )

    return NextResponse.json(
      { message: '신청이 완료되었습니다', count: parseInt(result?.count ?? '0', 10) },
      { status: 201 }
    )
  } catch (error: unknown) {
    // 중복 전화번호/이메일 (unique constraint)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return NextResponse.json({ error: '이미 신청하신 연락처입니다' }, { status: 409 })
    }
    logger.error('[waitlist POST]', { error })
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
