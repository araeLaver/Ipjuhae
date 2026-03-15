import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'

interface WaitlistRow {
  id: number
  email: string
  user_type: string
  signed_up_at: string | null
}

// GET /api/invite/[token] — 초대 토큰 검증
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length !== 64) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  try {
    const row = await queryOne<WaitlistRow>(
      `SELECT id, email, user_type, signed_up_at FROM waitlist WHERE invite_token = $1`,
      [token]
    )

    if (!row) {
      return NextResponse.json({ valid: false }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      email: row.email,
      userType: row.user_type,
      signedUp: !!row.signed_up_at,
    })
  } catch (error) {
    console.error('[invite validate]', error)
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
