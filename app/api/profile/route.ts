import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { Profile } from '@/types/database'

// GET: 내 프로필 조회
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [user.id]
    )

    return NextResponse.json({ profile })
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
    const {
      name,
      age_range,
      family_type,
      pets,
      smoking,
      stay_time,
      duration,
      noise_level,
      bio,
      intro,
      is_complete,
    } = body

    // 기존 프로필 확인
    const existingProfile = await queryOne<Profile>(
      'SELECT id FROM profiles WHERE user_id = $1',
      [user.id]
    )

    let profile: Profile

    if (existingProfile) {
      // 업데이트
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
        [name, age_range, family_type, pets, smoking, stay_time, duration, noise_level, bio, intro, is_complete, user.id]
      )
      profile = updated
    } else {
      // 생성
      const [created] = await query<Profile>(
        `INSERT INTO profiles (user_id, name, age_range, family_type, pets, smoking, stay_time, duration, noise_level, bio, intro, is_complete)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [user.id, name, age_range, family_type, pets || ['없음'], smoking || false, stay_time, duration, noise_level, bio, intro, is_complete || false]
      )
      profile = created
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Save profile error:', error)
    return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다' }, { status: 500 })
  }
}
