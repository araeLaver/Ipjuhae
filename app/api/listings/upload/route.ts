import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { uploadListingPhoto } from '@/lib/upload'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// POST /api/listings/upload
export async function POST(request: Request) {
  try {
    // JWT auth
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    // Parse multipart form
    const formData = await request.formData()
    const files = formData.getAll('photos') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '업로드할 사진을 선택해주세요' }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `사진은 최대 ${MAX_FILES}장까지 업로드할 수 있습니다` },
        { status: 400 }
      )
    }

    // Validate each file
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식입니다: ${file.type}` },
          { status: 400 }
        )
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `파일 크기는 10MB 이하여야 합니다: ${file.name}` },
          { status: 400 }
        )
      }
    }

    // Upload all files
    const uploadResults = await Promise.allSettled(
      files.map((file) => uploadListingPhoto(file, file.name))
    )

    const urls: string[] = []
    const errors: string[] = []

    for (let i = 0; i < uploadResults.length; i++) {
      const result = uploadResults[i]
      if (result.status === 'fulfilled') {
        urls.push(result.value)
      } else {
        errors.push(`파일 ${files[i].name} 업로드 실패: ${result.reason}`)
      }
    }

    if (urls.length === 0) {
      return NextResponse.json(
        { error: '모든 사진 업로드에 실패했습니다', details: errors },
        { status: 500 }
      )
    }

    return NextResponse.json({
      urls,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    })
  } catch (error) {
    console.error('[POST /api/listings/upload]', error)
    return NextResponse.json({ error: '사진 업로드에 실패했습니다' }, { status: 500 })
  }
}
