import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { Profile } from '@/types/database'
import { generateIntro } from '@/lib/openai'

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [user.id]
    )

    if (!profile || !profile.name || !profile.age_range) {
      return NextResponse.json(
        { error: '기본 프로필 정보를 먼저 완성해주세요' },
        { status: 400 }
      )
    }

    const intro = await generateIntro(profile)

    return NextResponse.json({ intro })
  } catch (error) {
    console.error('Generate intro error:', error)
    return NextResponse.json(
      { error: '자기소개서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
