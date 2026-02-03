import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { User, Profile, Verification } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'
import { tenantFilterSchema } from '@/lib/validations'

// GET: 세입자 목록 조회 (필터, 페이지네이션)
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const parsed = tenantFilterSchema.safeParse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      ageRange: searchParams.get('ageRange') || undefined,
      familyType: searchParams.get('familyType') || undefined,
      minScore: searchParams.get('minScore') || undefined,
      smoking: searchParams.get('smoking') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '잘못된 필터 값입니다' },
        { status: 400 }
      )
    }

    const { page, limit, ageRange, familyType, minScore, smoking } = parsed.data
    const offset = (page - 1) * limit

    const conditions = ['p.is_complete = TRUE']
    const params: (string | number | boolean)[] = []
    let paramIndex = 1

    if (ageRange) {
      conditions.push(`p.age_range = $${paramIndex}`)
      params.push(ageRange)
      paramIndex++
    }

    if (familyType) {
      conditions.push(`p.family_type = $${paramIndex}`)
      params.push(familyType)
      paramIndex++
    }

    if (minScore !== undefined) {
      conditions.push(`p.trust_score >= $${paramIndex}`)
      params.push(minScore)
      paramIndex++
    }

    if (smoking !== undefined) {
      conditions.push(`p.smoking = $${paramIndex}`)
      params.push(smoking === 'true')
      paramIndex++
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    const profiles = await query<Profile & { verification?: Verification }>(
      `SELECT p.*, v.*
       FROM profiles p
       LEFT JOIN verifications v ON p.user_id = v.user_id
       ${whereClause}
       ORDER BY p.trust_score DESC, p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    )

    const [countResult] = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM profiles p ${whereClause}`,
      params
    )
    const totalCount = parseInt(countResult?.count || '0')

    const enrichedProfiles = profiles.map((p) => {
      const verification = p.verification || null
      const scoreBreakdown = calculateTrustScore({ profile: p, verification })
      return {
        ...p,
        trust_score: scoreBreakdown.total,
        verification,
      }
    })

    return NextResponse.json({
      profiles: enrichedProfiles,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Get tenants error:', error)
    return NextResponse.json({ error: '세입자 목록 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
