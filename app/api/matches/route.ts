import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { matchListings, MatchListing } from '@/lib/matching'
import { TenantProfile } from '@/types/database'
import { logger } from '@/lib/logger'

interface ListingRow {
  id: number
  monthly_rent: string
  address: string
  available_from: string | null
  deposit: string
  area_sqm: string | null
  floor: number | null
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const profile = await queryOne<TenantProfile>(
      'SELECT * FROM tenant_profiles WHERE user_id = $1',
      [user.id]
    )

    if (!profile) {
      return NextResponse.json(
        { error: '임차인 프로필을 먼저 작성해주세요', matches: [] },
        { status: 200 }
      )
    }

    const rows = await query<ListingRow>(
      `SELECT id, monthly_rent, deposit, address, area_sqm, floor, available_from
       FROM listings
       ORDER BY created_at DESC
       LIMIT 200`
    )

    const listings: MatchListing[] = rows.map((r) => ({
      id: r.id,
      monthly_rent: parseInt(String(r.monthly_rent)),
      address: r.address,
      available_from: r.available_from,
      deposit: parseInt(String(r.deposit)),
      area_sqm: r.area_sqm ? parseFloat(String(r.area_sqm)) : null,
      floor: r.floor,
    }))

    const matches = matchListings(
      {
        budget_min: profile.budget_min,
        budget_max: profile.budget_max,
        preferred_districts: profile.preferred_districts,
        move_in_date: profile.move_in_date,
      },
      listings
    )

    return NextResponse.json({ matches, total: matches.length })
  } catch (error) {
    logger.error('매칭 조회 오류', { error })
    return NextResponse.json({ error: '매칭 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
