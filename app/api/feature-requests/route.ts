import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const VALID_USER_TYPES = ['tenant', 'landlord', 'agent'] as const
const VALID_SOURCES = ['preview', 'landing'] as const

// POST /api/feature-requests — 기능 요구사항 접수 (로그인 불필요)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, contact, user_type, source } = body as {
      message?: string
      contact?: string
      user_type?: string
      source?: string
    }

    const trimmedMessage = typeof message === 'string' ? message.trim() : ''
    if (!trimmedMessage) {
      return NextResponse.json({ error: '원하시는 기능을 적어주세요' }, { status: 400 })
    }
    if (trimmedMessage.length > 2000) {
      return NextResponse.json({ error: '2000자 이내로 적어주세요' }, { status: 400 })
    }

    let trimmedContact: string | null = null
    if (contact !== undefined && contact !== null && contact !== '') {
      if (typeof contact !== 'string' || contact.trim().length > 100) {
        return NextResponse.json({ error: '연락처는 100자 이내로 적어주세요' }, { status: 400 })
      }
      trimmedContact = contact.trim()
    }

    let normalizedUserType: string | null = null
    if (user_type !== undefined && user_type !== null && user_type !== '') {
      if (!VALID_USER_TYPES.includes(user_type as (typeof VALID_USER_TYPES)[number])) {
        return NextResponse.json({ error: '올바르지 않은 사용자 유형입니다' }, { status: 400 })
      }
      normalizedUserType = user_type
    }

    const normalizedSource = VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])
      ? (source as string)
      : 'preview'

    await query(
      `INSERT INTO feature_requests (message, contact, user_type, source)
       VALUES ($1, $2, $3, $4)`,
      [trimmedMessage, trimmedContact, normalizedUserType, normalizedSource]
    )

    return NextResponse.json({ message: '소중한 의견 감사합니다' }, { status: 201 })
  } catch (error) {
    logger.error('[feature-requests POST]', { error })
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
