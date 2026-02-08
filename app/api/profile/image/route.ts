import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { uploadProfileImage } from '@/lib/storage'

// POST: 프로필 이미지 업로드
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다' }, { status: 400 })
    }

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다' }, { status: 400 })
    }

    // 이미지 타입 검증
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다' }, { status: 400 })
    }

    // 이미지 업로드 (자동 최적화: 400x400 WebP)
    const result = await uploadProfileImage(
      user.id,
      file,
      file.name,
      file.type
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || '업로드 실패' }, { status: 400 })
    }

    // DB 업데이트
    await query(
      'UPDATE users SET profile_image = $1 WHERE id = $2',
      [result.url, user.id]
    )

    return NextResponse.json({
      success: true,
      imageUrl: result.url
    })
  } catch (error) {
    console.error('Profile image upload error:', error)
    return NextResponse.json(
      { error: '이미지 업로드 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

// DELETE: 프로필 이미지 삭제
export async function DELETE() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // DB에서 프로필 이미지 NULL로 설정
    await query(
      'UPDATE users SET profile_image = NULL WHERE id = $1',
      [user.id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Profile image delete error:', error)
    return NextResponse.json(
      { error: '이미지 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
