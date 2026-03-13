import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

interface CountRow {
  count: string
}

export async function GET() {
  try {
    // KST(UTC+9) 기준 오늘 00:00:00
    const todayKst = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
    )
    todayKst.setHours(0, 0, 0, 0)
    // KST 자정을 UTC로 역산: KST = UTC+9 이므로 UTC = KST - 9h
    const todayUtc = new Date(todayKst.getTime() - 9 * 60 * 60 * 1000)

    const [profileRow] = await query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM profiles WHERE created_at >= $1`,
      [todayUtc.toISOString()]
    )

    const [listingRow] = await query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM listings WHERE created_at >= $1`,
      [todayUtc.toISOString()]
    )

    const dateStr = todayKst.toISOString().slice(0, 10)

    return NextResponse.json({
      newProfiles: parseInt(profileRow?.count ?? '0'),
      newListings: parseInt(listingRow?.count ?? '0'),
      date: dateStr,
    })
  } catch (error) {
    console.error('Admin today stats error:', error)
    return NextResponse.json({ error: '통계 조회 실패' }, { status: 500 })
  }
}
