import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

// GET /api/waitlist — 전체 대기자 수 반환
export async function GET() {
  try {
    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM waitlist'
    )
    return NextResponse.json({ count: parseInt(result?.count ?? '0', 10) })
  } catch (error) {
    console.error('[waitlist GET]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST /api/waitlist — 이메일 등록
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, user_type } = body as { email?: string; user_type?: string }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다' }, { status: 400 })
    }

    if (!user_type || !['tenant', 'landlord'].includes(user_type)) {
      return NextResponse.json({ error: '사용자 유형을 선택해주세요' }, { status: 400 })
    }

    await query(
      'INSERT INTO waitlist (email, user_type) VALUES ($1, $2)',
      [email.toLowerCase().trim(), user_type]
    )

    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM waitlist'
    )

    return NextResponse.json(
      { message: '신청이 완료되었습니다', count: parseInt(result?.count ?? '0', 10) },
      { status: 201 }
    )
  } catch (error: unknown) {
    // 중복 이메일 (unique constraint)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return NextResponse.json({ error: '이미 신청하신 이메일입니다' }, { status: 409 })
    }
    console.error('[waitlist POST]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
