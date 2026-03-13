import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { getCurrentUser, verifyToken } from '@/lib/auth'
import { tenantProfileSchema } from '@/lib/schemas/tenant-profile'

interface TenantProfile {
  id: number
  user_id: number
  budget_min: number
  budget_max: number
  preferred_region: string
  move_in_date: string | null
  has_pets: boolean
  job_title: string | null
  company_name: string | null
  created_at: Date
  updated_at: Date
}

async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  // Check Authorization header first (Bearer token)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    if (payload) return payload.userId
  }

  // Fall back to cookie-based auth
  const user = await getCurrentUser()
  if (user) return user.id

  return null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const profile = await queryOne<TenantProfile>(
      'SELECT * FROM tenant_profiles WHERE user_id = $1',
      [userId]
    )

    return NextResponse.json({ profile: profile ?? null })
  } catch (error) {
    console.error('GET /api/tenant/profile error:', error)
    return NextResponse.json({ error: '프로필 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request)
    if (!userId) {
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

    const {
      budget_min,
      budget_max,
      preferred_region,
      move_in_date,
      has_pets,
      job_title,
      company_name,
    } = parsed.data

    const [profile] = await query<TenantProfile>(
      `INSERT INTO tenant_profiles
        (user_id, budget_min, budget_max, preferred_region, move_in_date, has_pets, job_title, company_name, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
        budget_min = EXCLUDED.budget_min,
        budget_max = EXCLUDED.budget_max,
        preferred_region = EXCLUDED.preferred_region,
        move_in_date = EXCLUDED.move_in_date,
        has_pets = EXCLUDED.has_pets,
        job_title = EXCLUDED.job_title,
        company_name = EXCLUDED.company_name,
        updated_at = NOW()
       RETURNING *`,
      [
        userId,
        budget_min,
        budget_max,
        preferred_region,
        move_in_date ?? null,
        has_pets,
        job_title ?? null,
        company_name ?? null,
      ]
    )

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('PUT /api/tenant/profile error:', error)
    return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다' }, { status: 500 })
  }
}
