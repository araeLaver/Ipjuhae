import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { matchListings, TenantProfile, Listing } from '@/lib/matching'
import { logger } from '@/lib/logger'

interface TenantPreferenceRow {
  budget_min: number
  budget_max: number
  preferred_region: string
  move_in_date: string | null
}

interface PropertyRow {
  id: number
  monthly_rent: number
  address: string
  available_from: string | null
  title: string
  region: string | null
  deposit: number
  property_type: string
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 세입자 매칭 선호도 조회 (tenant_preferences 테이블이 없으면 profiles에서 fallback)
    const preference = await queryOne<TenantPreferenceRow>(
      `SELECT
        COALESCE(tp.budget_min, 0)           AS budget_min,
        COALESCE(tp.budget_max, 9999999)     AS budget_max,
        COALESCE(tp.preferred_region, '')    AS preferred_region,
        tp.move_in_date
      FROM tenant_preferences tp
      WHERE tp.user_id = $1`,
      [user.id]
    )

    if (!preference) {
      return NextResponse.json(
        { error: '매칭 선호도가 설정되지 않았습니다. 선호도를 먼저 입력해주세요.' },
        { status: 404 }
      )
    }

    const tenantProfile: TenantProfile = {
      budget_min: Number(preference.budget_min),
      budget_max: Number(preference.budget_max),
      preferred_region: preference.preferred_region,
      move_in_date: preference.move_in_date,
    }

    // 이용 가능한 매물 전체 조회
    const rows = await query<PropertyRow>(
      `SELECT
        id,
        monthly_rent,
        address,
        available_from,
        title,
        region,
        deposit,
        property_type
      FROM properties
      WHERE status = 'available'`
    )

    const listings: Listing[] = rows.map((row) => ({
      id: Number(row.id),
      monthly_rent: Number(row.monthly_rent),
      address: row.address,
      available_from: row.available_from,
      title: row.title,
      region: row.region,
      deposit: Number(row.deposit),
      property_type: row.property_type,
    }))

    const results = matchListings(tenantProfile, listings)

    // 매칭된 매물의 상세 정보를 함께 반환
    const listingMap = new Map(listings.map((l) => [l.id, l]))

    const matches = results.map((r) => {
      const listing = listingMap.get(r.listing_id)
      return {
        ...r,
        listing,
      }
    })

    return NextResponse.json({
      matches,
      total: matches.length,
      profile: tenantProfile,
    })
  } catch (error) {
    logger.error('매칭 조회 오류', { error })
    return NextResponse.json({ error: '매칭 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
