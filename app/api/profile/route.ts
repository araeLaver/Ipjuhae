import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { Profile, Verification, ReferenceResponse, User } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'
import { profileSchema } from '@/lib/validations'
import { sanitizeUserInput } from '@/lib/sanitize'

// GET: 내 프로필 조회 (동적 신뢰점수 포함)
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 프로필 이미지 조회
    const userRecord = await queryOne<User>(
      'SELECT profile_image FROM users WHERE id = $1',
      [user.id]
    )

    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [user.id]
    )

    const verification = await queryOne<Verification>(
      'SELECT * FROM verifications WHERE user_id = $1',
      [user.id]
    )

    const referenceResponses = await query<ReferenceResponse>(
      `SELECT rr.* FROM reference_responses rr
       JOIN landlord_references lr ON rr.reference_id = lr.id
       WHERE lr.user_id = $1 AND lr.status = 'completed'`,
      [user.id]
    )

    let dynamicProfile = profile
    let trustScoreBreakdown = null
    if (profile) {
      const scoreBreakdown = calculateTrustScore({
        profile,
        verification,
        referenceResponses,
      })
      dynamicProfile = {
        ...profile,
        trust_score: scoreBreakdown.total,
      }
      trustScoreBreakdown = scoreBreakdown
    }

    return NextResponse.json({
      profile: dynamicProfile,
      verification,
      trustScoreBreakdown,
      profileImage: userRecord?.profile_image || null,
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json({ error: '프로필 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST: 프로필 생성/업데이트
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = profileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값이 올바르지 않습니다' },
        { status: 400 }
      )
    }

    const {
      name, age_range, family_type, pets, smoking,
      stay_time, duration, noise_level, bio, intro, is_complete,
    } = parsed.data

    // XSS 방지를 위한 사용자 입력 sanitization
    const sanitizedName = name ? sanitizeUserInput(name) : name
    const sanitizedBio = bio ? sanitizeUserInput(bio) : bio
    const sanitizedIntro = intro ? sanitizeUserInput(intro) : intro

    const existingProfile = await queryOne<Profile>(
      'SELECT id FROM profiles WHERE user_id = $1',
      [user.id]
    )

    let profile: Profile

    if (existingProfile) {
      const [updated] = await query<Profile>(
        `UPDATE profiles SET
          name = COALESCE($1, name),
          age_range = COALESCE($2, age_range),
          family_type = COALESCE($3, family_type),
          pets = COALESCE($4, pets),
          smoking = COALESCE($5, smoking),
          stay_time = COALESCE($6, stay_time),
          duration = COALESCE($7, duration),
          noise_level = COALESCE($8, noise_level),
          bio = COALESCE($9, bio),
          intro = COALESCE($10, intro),
          is_complete = COALESCE($11, is_complete)
        WHERE user_id = $12
        RETURNING *`,
        [sanitizedName, age_range, family_type, pets, smoking, stay_time, duration, noise_level, sanitizedBio, sanitizedIntro, is_complete, user.id]
      )
      profile = updated
    } else {
      const [created] = await query<Profile>(
        `INSERT INTO profiles (user_id, name, age_range, family_type, pets, smoking, stay_time, duration, noise_level, bio, intro, is_complete)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [user.id, sanitizedName, age_range, family_type, pets || ['없음'], smoking ?? false, stay_time, duration, noise_level, sanitizedBio, sanitizedIntro, is_complete ?? false]
      )
      profile = created
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Save profile error:', error)
    return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다' }, { status: 500 })
  }
}
