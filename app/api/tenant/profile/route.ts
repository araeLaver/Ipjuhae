import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { TenantProfile } from '@/types/database'
import { tenantProfileSchema } from '@/lib/validations'
import { sanitizeUserInput } from '@/lib/sanitize'
import { trackServer } from '@/lib/analytics'

// GET: 임차인 프로필 조회
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

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Get tenant profile error:', error)
    return NextResponse.json({ error: '프로필 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// PUT: 임차인 프로필 생성/업데이트
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = tenantProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다' },
        { status: 400 }
      )
    }

    const { budget_min, budget_max, preferred_districts, move_in_date, has_pets, workplace } = parsed.data

    const sanitizedWorkplace = workplace ? sanitizeUserInput(workplace) : null

    const existing = await queryOne<TenantProfile>(
      'SELECT id FROM tenant_profiles WHERE user_id = $1',
      [user.id]
    )

    let profile: TenantProfile

    if (existing) {
      const [updated] = await query<TenantProfile>(
        `UPDATE tenant_profiles SET
          budget_min = $1,
          budget_max = $2,
          preferred_districts = $3,
          move_in_date = $4,
          has_pets = $5,
          workplace = $6
        WHERE user_id = $7
        RETURNING *`,
        [budget_min, budget_max, preferred_districts, move_in_date, has_pets, sanitizedWorkplace, user.id]
      )
      profile = updated
    } else {
      const [created] = await query<TenantProfile>(
        `INSERT INTO tenant_profiles (user_id, budget_min, budget_max, preferred_districts, move_in_date, has_pets, workplace)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [user.id, budget_min, budget_max, preferred_districts, move_in_date, has_pets, sanitizedWorkplace]
      )
      profile = created
    }

    await trackServer('profile_submitted', {
      userId: String(user.id),
      timestamp: new Date().toISOString(),
      is_update: !!existing,
    })

    // Track profile_complete for analytics baseline (#27/#31)
    await trackServer('profile_complete', {
      userId: String(user.id),
      properties: {
        budget_min,
        budget_max,
        region_count: preferred_districts.length,
        has_pets,
        is_update: !!existing,
      },
    })

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Save tenant profile error:', error)
    return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다' }, { status: 500 })
  }
}
