import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAdminUser } from '@/lib/admin'

interface CountRow {
  count: string
}

export async function GET() {
  if (!(await getAdminUser()))
    return NextResponse.json(
      { error: '관리자 권한이 필요합니다' },
      { status: 403 },
    )
  try {
    // Compute KST date independently of the server's local timezone.
    const dateStr = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const todayUtc = new Date(`${dateStr}T00:00:00+09:00`)

    const [profileRow] = await query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM profiles WHERE created_at >= $1`,
      [todayUtc.toISOString()],
    )

    const [listingRow] = await query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM listings WHERE created_at >= $1`,
      [todayUtc.toISOString()],
    )

    return NextResponse.json({
      newProfiles: parseInt(profileRow?.count ?? '0'),
      newListings: parseInt(listingRow?.count ?? '0'),
      date: dateStr,
    })
  } catch (error) {
    logger.error('Admin today stats error', { error })
    return NextResponse.json({ error: '통계 조회 실패' }, { status: 500 })
  }
}
