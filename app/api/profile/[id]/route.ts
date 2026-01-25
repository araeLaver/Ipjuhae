import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { Profile } from '@/types/database'

// GET: 공개 프로필 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE id = $1 AND is_complete = true',
      [id]
    )

    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Get public profile error:', error)
    return NextResponse.json({ error: '프로필 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
