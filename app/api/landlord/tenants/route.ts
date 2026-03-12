import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { User, Verification } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'
import { tenantFilterSchema, SortOption } from '@/lib/validations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantCard {
  profile_id: string
  name: string
  age_range: string
  family_type: string
  pets: string[]
  smoking: boolean
  stay_time: string | null
  duration: string | null
  noise_level: string | null
  trust_score: number
  bio: string | null
  verified: {
    employment: boolean
    income: boolean
    credit: boolean
  }
  reference_count: number
  profile_image_url: string | null
  created_at: string
}

interface CursorPayload {
  score: number
  id: string
}

interface ProfileRow {
  profile_id: string
  user_id: string
  name: string
  age_range: string
  family_type: string
  pets: string[]
  smoking: boolean
  stay_time: string | null
  duration: string | null
  noise_level: string | null
  trust_score: number
  bio: string | null
  profile_image_url: string | null
  created_at: Date
  employment_verified: boolean | null
  income_verified: boolean | null
  credit_verified: boolean | null
  ref_count: string
  verified_count: string
  verification?: Verification
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskName(name: string): string {
  if (!name || name.length < 2) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

function encodeCursor(score: number, id: string): string {
  return Buffer.from(JSON.stringify({ score, id })).toString('base64')
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as CursorPayload
  } catch {
    return null
  }
}

function buildOrderClause(sort: SortOption): string {
  switch (sort) {
    case 'created_desc':
      return 'p.created_at DESC, p.id ASC'
    case 'reference_desc':
      return 'ref_count DESC, p.trust_score DESC, p.id ASC'
    case 'verified_desc':
      return 'verified_count DESC, p.trust_score DESC, p.id ASC'
    case 'trust_desc':
    default:
      return 'p.trust_score DESC, p.id ASC'
  }
}

// ---------------------------------------------------------------------------
// GET /api/landlord/tenants
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const fullUser = await queryOne<User>('SELECT * FROM users WHERE id = $1', [user.id])
    if (fullUser?.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 접근할 수 있습니다' }, { status: 403 })
    }

    // ---------- Parse multi-value query params ----------
    const url = new URL(request.url)
    const raw: Record<string, string | string[]> = {}
    url.searchParams.forEach((value, key) => {
      const existing = raw[key]
      if (existing !== undefined) {
        raw[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      } else {
        raw[key] = value
      }
    })

    const parsed = tenantFilterSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '잘못된 필터 값입니다' },
        { status: 400 }
      )
    }

    const {
      cursor,
      limit,
      region,
      family_type,
      pets,
      noise_level,
      duration,
      verified,
      smoking,
      has_reference,
      trust_min,
      trust_max,
      sort,
    } = parsed.data

    // ---------- Build base WHERE conditions ----------
    const baseConditions: string[] = ['p.is_complete = TRUE']
    const baseParams: unknown[] = []
    let idx = 1

    if (region && region.length > 0) {
      baseConditions.push(`p.preferred_regions && $${idx}::text[]`)
      baseParams.push(region)
      idx++
    }

    if (family_type && family_type.length > 0) {
      baseConditions.push(`p.family_type = ANY($${idx}::text[])`)
      baseParams.push(family_type)
      idx++
    }

    if (pets && pets.length > 0) {
      baseConditions.push(`p.pets && $${idx}::text[]`)
      baseParams.push(pets)
      idx++
    }

    if (smoking !== undefined) {
      baseConditions.push(`p.smoking = $${idx}`)
      baseParams.push(smoking === 'true')
      idx++
    }

    if (noise_level && noise_level.length > 0) {
      baseConditions.push(`p.noise_level = ANY($${idx}::text[])`)
      baseParams.push(noise_level)
      idx++
    }

    if (duration && duration.length > 0) {
      baseConditions.push(`p.duration = ANY($${idx}::text[])`)
      baseParams.push(duration)
      idx++
    }

    if (trust_min !== undefined) {
      baseConditions.push(`p.trust_score >= $${idx}`)
      baseParams.push(trust_min)
      idx++
    }

    if (trust_max !== undefined) {
      baseConditions.push(`p.trust_score <= $${idx}`)
      baseParams.push(trust_max)
      idx++
    }

    if (has_reference === 'true') {
      baseConditions.push(
        `(SELECT COUNT(*) FROM landlord_references lr WHERE lr.user_id = p.user_id AND lr.status = 'completed') > 0`
      )
    }

    if (verified && verified.length > 0) {
      if (verified.includes('employment')) baseConditions.push('COALESCE(v.employment_verified, FALSE) = TRUE')
      if (verified.includes('income')) baseConditions.push('COALESCE(v.income_verified, FALSE) = TRUE')
      if (verified.includes('credit')) baseConditions.push('COALESCE(v.credit_verified, FALSE) = TRUE')
    }

    const baseWhere = `WHERE ${baseConditions.join(' AND ')}`

    // ---------- Total count ----------
    const [countRow] = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM profiles p
       LEFT JOIN verifications v ON p.user_id = v.user_id
       ${baseWhere}`,
      baseParams as (string | number | boolean)[]
    )
    const totalCount = parseInt(countRow?.count ?? '0', 10)

    // ---------- Cursor condition (trust_desc only; others use offset) ----------
    const allConditions = [...baseConditions]
    const allParams: unknown[] = [...baseParams]

    const cursorPayload = cursor ? decodeCursor(cursor) : null
    if (cursorPayload && sort === 'trust_desc') {
      allConditions.push(
        `(p.trust_score < $${idx} OR (p.trust_score = $${idx} AND p.id > $${idx + 1}))`
      )
      allParams.push(cursorPayload.score, cursorPayload.id)
      idx += 2
    }

    const finalWhere = `WHERE ${allConditions.join(' AND ')}`
    const orderClause = buildOrderClause(sort)

    // ---------- Main query ----------
    const rows = await query<ProfileRow>(
      `SELECT
         p.id            AS profile_id,
         p.user_id,
         p.name,
         p.age_range,
         p.family_type,
         p.pets,
         p.smoking,
         p.stay_time,
         p.duration,
         p.noise_level,
         p.trust_score,
         p.bio,
         p.created_at,
         u.profile_image AS profile_image_url,
         COALESCE(v.employment_verified, FALSE) AS employment_verified,
         COALESCE(v.income_verified, FALSE)     AS income_verified,
         COALESCE(v.credit_verified, FALSE)     AS credit_verified,
         (
           SELECT COUNT(*) FROM landlord_references lr
           WHERE lr.user_id = p.user_id AND lr.status = 'completed'
         )::text AS ref_count,
         (
           COALESCE(v.employment_verified::int, 0) +
           COALESCE(v.income_verified::int, 0) +
           COALESCE(v.credit_verified::int, 0)
         )::text AS verified_count
       FROM profiles p
       LEFT JOIN verifications v ON p.user_id = v.user_id
       LEFT JOIN users u ON p.user_id = u.id
       ${finalWhere}
       ORDER BY ${orderClause}
       LIMIT $${idx}`,
      [...(allParams as (string | number | boolean)[]), limit]
    )

    // ---------- Map to TenantCard ----------
    const tenants: TenantCard[] = rows.map((row) => {
      const profileForScore = {
        id: row.profile_id,
        user_id: row.user_id,
        name: row.name,
        age_range: row.age_range,
        family_type: row.family_type,
        pets: row.pets,
        smoking: row.smoking,
        stay_time: row.stay_time,
        duration: row.duration,
        noise_level: row.noise_level,
        bio: row.bio,
        intro: null,
        trust_score: row.trust_score,
        is_complete: true,
        created_at: row.created_at,
        updated_at: row.created_at,
      } as import('@/types/database').Profile

      const scoreResult = calculateTrustScore({
        profile: profileForScore,
        verification: row.verification ?? null,
      })

      return {
        profile_id: row.profile_id,
        name: maskName(row.name),
        age_range: row.age_range,
        family_type: row.family_type,
        pets: row.pets ?? [],
        smoking: row.smoking,
        stay_time: row.stay_time,
        duration: row.duration,
        noise_level: row.noise_level,
        trust_score: scoreResult.total,
        bio: row.bio,
        verified: {
          employment: row.employment_verified ?? false,
          income: row.income_verified ?? false,
          credit: row.credit_verified ?? false,
        },
        reference_count: parseInt(row.ref_count ?? '0', 10),
        profile_image_url: row.profile_image_url ?? null,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      }
    })

    // ---------- Next cursor ----------
    let nextCursor: string | null = null
    if (rows.length === limit && rows.length > 0) {
      const last = rows[rows.length - 1]
      nextCursor = encodeCursor(last.trust_score, last.profile_id)
    }

    return NextResponse.json({
      tenants,
      next_cursor: nextCursor,
      total_count: totalCount,
    })
  } catch (error) {
    console.error('Get tenants error:', error)
    return NextResponse.json({ error: '세입자 목록 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
