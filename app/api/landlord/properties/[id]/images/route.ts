import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { uploadFile } from '@/lib/storage'
import { optimizeProfileImage, createThumbnail } from '@/lib/image'
import { z } from 'zod'

interface PropertyRow {
  id: string
  landlord_id: string
}

interface ImageRow {
  id: string
  property_id: string
  image_url: string
  thumbnail_url: string | null
  sort_order: number
  is_main: boolean
  created_at: string
}

interface UserRow {
  user_type: 'tenant' | 'landlord'
}

interface CountRow {
  count: string
}

// POST /api/landlord/properties/[id]/images - 이미지 업로드
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    // 집주인 확인
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0 || userResult[0].user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 접근할 수 있습니다' }, { status: 403 })
    }

    // 매물 소유권 확인
    const ownerCheck = await query<PropertyRow>(
      'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
      [propertyId, payload.userId]
    )

    if (ownerCheck.length === 0) {
      return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const isMain = formData.get('isMain') === 'true'

    if (!file) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다' }, { status: 400 })
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다' }, { status: 400 })
    }

    // 이미지 타입 확인
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '이미지 파일만 업로드할 수 있습니다' }, { status: 400 })
    }

    // 이미지 개수 제한 (최대 10개)
    const countResult = await query<CountRow>(
      'SELECT COUNT(*) as count FROM property_images WHERE property_id = $1',
      [propertyId]
    )
    const imageCount = parseInt(countResult[0]?.count || '0')

    if (imageCount >= 10) {
      return NextResponse.json({ error: '매물당 이미지는 최대 10개까지 등록할 수 있습니다' }, { status: 400 })
    }

    // 이미지 처리
    const buffer = Buffer.from(await file.arrayBuffer())
    const optimizedResult = await optimizeProfileImage(buffer)
    const thumbnailResult = await createThumbnail(buffer)

    if (!optimizedResult.success || !optimizedResult.buffer) {
      return NextResponse.json({ error: '이미지 최적화에 실패했습니다' }, { status: 500 })
    }

    // 파일 업로드
    const timestamp = Date.now()

    const imageUploadResult = await uploadFile({
      file: optimizedResult.buffer,
      fileName: `${timestamp}.webp`,
      contentType: 'image/webp',
      folder: `properties/${propertyId}`,
    })

    let thumbnailUrl = imageUploadResult.url

    if (thumbnailResult.success && thumbnailResult.buffer) {
      const thumbnailUploadResult = await uploadFile({
        file: thumbnailResult.buffer,
        fileName: `${timestamp}_thumb.webp`,
        contentType: 'image/webp',
        folder: `properties/${propertyId}`,
      })
      if (thumbnailUploadResult.success && thumbnailUploadResult.url) {
        thumbnailUrl = thumbnailUploadResult.url
      }
    }

    if (!imageUploadResult.success || !imageUploadResult.url) {
      return NextResponse.json({ error: '이미지 업로드에 실패했습니다' }, { status: 500 })
    }

    const imageUrl = imageUploadResult.url

    // 다음 정렬 순서 가져오기
    const sortOrder = imageCount

    // 메인 이미지 설정 시 기존 메인 이미지 해제
    if (isMain) {
      await query(
        'UPDATE property_images SET is_main = FALSE WHERE property_id = $1',
        [propertyId]
      )
    }

    // 첫 번째 이미지는 자동으로 메인으로 설정
    const shouldBeMain = isMain || imageCount === 0

    // DB에 이미지 정보 저장
    const result = await query<ImageRow>(
      `INSERT INTO property_images (property_id, image_url, thumbnail_url, sort_order, is_main)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [propertyId, imageUrl, thumbnailUrl, sortOrder, shouldBeMain]
    )

    return NextResponse.json({ image: result[0] })
  } catch (error) {
    console.error('이미지 업로드 오류:', error)
    return NextResponse.json({ error: '이미지 업로드에 실패했습니다' }, { status: 500 })
  }
}

// DELETE /api/landlord/properties/[id]/images - 이미지 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    // 집주인 확인
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0 || userResult[0].user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 접근할 수 있습니다' }, { status: 403 })
    }

    // 매물 소유권 확인
    const ownerCheck = await query<PropertyRow>(
      'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
      [propertyId, payload.userId]
    )

    if (ownerCheck.length === 0) {
      return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json({ error: '이미지 ID가 필요합니다' }, { status: 400 })
    }

    // 이미지 삭제
    const result = await query<ImageRow>(
      'DELETE FROM property_images WHERE id = $1 AND property_id = $2 RETURNING is_main',
      [imageId, propertyId]
    )

    if (result.length === 0) {
      return NextResponse.json({ error: '이미지를 찾을 수 없습니다' }, { status: 404 })
    }

    // 삭제된 이미지가 메인이었다면 첫 번째 이미지를 메인으로 설정
    if (result[0].is_main) {
      await query(
        `UPDATE property_images SET is_main = TRUE
         WHERE property_id = $1 AND id = (
           SELECT id FROM property_images WHERE property_id = $1 ORDER BY sort_order LIMIT 1
         )`,
        [propertyId]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('이미지 삭제 오류:', error)
    return NextResponse.json({ error: '이미지 삭제에 실패했습니다' }, { status: 500 })
  }
}

// PUT /api/landlord/properties/[id]/images - 이미지 순서/메인 변경
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    // 집주인 확인
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0 || userResult[0].user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 접근할 수 있습니다' }, { status: 403 })
    }

    // 매물 소유권 확인
    const ownerCheck = await query<PropertyRow>(
      'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
      [propertyId, payload.userId]
    )

    if (ownerCheck.length === 0) {
      return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await request.json()
    const schema = z.object({
      imageId: z.string().uuid(),
      setMain: z.boolean().optional(),
      sortOrder: z.number().min(0).optional(),
    })

    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { imageId, setMain, sortOrder } = validation.data

    if (setMain) {
      // 메인 이미지 변경
      await query(
        'UPDATE property_images SET is_main = FALSE WHERE property_id = $1',
        [propertyId]
      )
      await query(
        'UPDATE property_images SET is_main = TRUE WHERE id = $1 AND property_id = $2',
        [imageId, propertyId]
      )
    }

    if (sortOrder !== undefined) {
      await query(
        'UPDATE property_images SET sort_order = $1 WHERE id = $2 AND property_id = $3',
        [sortOrder, imageId, propertyId]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('이미지 업데이트 오류:', error)
    return NextResponse.json({ error: '이미지 업데이트에 실패했습니다' }, { status: 500 })
  }
}
