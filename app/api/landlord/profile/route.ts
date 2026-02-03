import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { LandlordProfile, User } from '@/types/database'
import { landlordProfileSchema } from '@/lib/validations'

// GET: 집주인 프로필 조회
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const fullUser = await queryOne<User>(
      'SELECT * FROM users WHERE id = $1',
      [user.id]
    )

    if (fullUser?.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 접근할 수 있습니다' }, { status: 403 })
    }

    const profile = await queryOne<LandlordProfile>(
      'SELECT * FROM landlord_profiles WHERE user_id = $1',
      [user.id]
    )

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Get landlord profile error:', error)
    return NextResponse.json({ error: '프로필 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST: 집주인 프로필 생성/업데이트
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = landlordProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다' },
        { status: 400 }
      )
    }

    const { name, phone, propertyCount, propertyRegions } = parsed.data

    const existingProfile = await queryOne<LandlordProfile>(
      'SELECT id FROM landlord_profiles WHERE user_id = $1',
      [user.id]
    )

    let profile: LandlordProfile

    if (existingProfile) {
      const [updated] = await query<LandlordProfile>(
        `UPDATE landlord_profiles SET
          name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          property_count = COALESCE($3, property_count),
          property_regions = COALESCE($4, property_regions)
        WHERE user_id = $5
        RETURNING *`,
        [name, phone, propertyCount, propertyRegions, user.id]
      )
      profile = updated
    } else {
      const [created] = await query<LandlordProfile>(
        `INSERT INTO landlord_profiles (user_id, name, phone, property_count, property_regions)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [user.id, name, phone, propertyCount ?? 0, propertyRegions ?? []]
      )
      profile = created
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Save landlord profile error:', error)
    return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다' }, { status: 500 })
  }
}
