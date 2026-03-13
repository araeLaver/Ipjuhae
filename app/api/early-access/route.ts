import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, city } = body as { email?: string; city?: string }

    // 이메일 필수 검증
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: '올바른 이메일 형식이 아닙니다' }, { status: 400 })
    }

    // 도시 필수 검증
    if (!city || typeof city !== 'string' || city.trim().length === 0) {
      return NextResponse.json({ error: '희망 지역을 선택해주세요' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const normalizedCity = city.trim()

    await query(
      'INSERT INTO early_access (email, city) VALUES ($1, $2)',
      [normalizedEmail, normalizedCity]
    )

    return NextResponse.json(
      { message: '얼리액세스 신청이 완료되었습니다' },
      { status: 201 }
    )
  } catch (error: unknown) {
    // PostgreSQL unique violation (중복 이메일)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return NextResponse.json(
        { error: '이미 신청하신 이메일입니다' },
        { status: 409 }
      )
    }
    console.error('[early-access POST]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM early_access'
    )
    return NextResponse.json({ count: parseInt(result?.count ?? '0', 10) })
  } catch (error) {
    console.error('[early-access GET]', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
