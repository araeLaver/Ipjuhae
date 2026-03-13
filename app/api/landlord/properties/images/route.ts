import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { uploadFile } from '@/lib/storage'
import { validateImage } from '@/lib/image'
import crypto from 'crypto'

interface UserRow {
  user_type: 'tenant' | 'landlord'
}

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

// POST /api/landlord/properties/images
// 매물 이미지 업로드 (multipart/form-data)
// body: { propertyId: string, image: File, sortOrder?: number, isMain?: boolean }
// propertyId가 없으면 임시 업로드 (URL만 반환)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = verifyToken(token)
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

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const propertyId = formData.get('propertyId') as string | null
    const sortOrderRaw = formData.get('sortOrder')
    const isMainRaw = formData.get('isMain')

    const sortOrder = sortOrderRaw ? parseInt(String(sortOrderRaw)) : 0
    const isMain = isMainRaw === 'true'

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

    const buffer = Buffer.from(await file.arrayBuffer())

    // 이미지 유효성 검사
    const validation = await validateImage(buffer, { maxSize: 10 * 1024 * 1024 })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || '유효하지 않은 이미지입니다' }, { status: 400 })
    }

    // 파일명 생성
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const random = crypto.randomBytes(8).toString('hex')
    const fileName = `${timestamp}-${random}.${ext}`

    // 이미지 업로드
    const folder = propertyId
      ? `properties/${payload.userId}/${propertyId}`
      : `properties/${payload.userId}/temp`

    const uploadResult = await uploadFile({
      file: buffer,
      fileName,
      contentType: file.type,
      folder,
    })

    if (!uploadResult.success || !uploadResult.url) {
      return NextResponse.json({ error: uploadResult.error || '업로드 실패' }, { status: 500 })
    }

    // propertyId가 있으면 DB에 저장
    if (propertyId) {
      // 소유권 확인
      const propertyResult = await query<PropertyRow>(
        'SELECT id, landlord_id FROM properties WHERE id = $1 AND landlord_id = $2',
        [propertyId, payload.userId]
      )

      if (propertyResult.length === 0) {
        return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
      }

      // isMain이면 기존 메인 이미지 해제
      if (isMain) {
        await query(
          'UPDATE property_images SET is_main = FALSE WHERE property_id = $1',
          [propertyId]
        )
      }

      const imageResult = await query<ImageRow>(
        `INSERT INTO property_images (property_id, image_url, sort_order, is_main)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [propertyId, uploadResult.url, sortOrder, isMain]
      )

      return NextResponse.json({
        success: true,
        image: imageResult[0],
        url: uploadResult.url,
      })
    }

    // propertyId 없으면 URL만 반환 (등록 전 임시 업로드)
    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      key: uploadResult.key,
    })
  } catch (error) {
    console.error('매물 이미지 업로드 오류:', error)
    return NextResponse.json({ error: '이미지 업로드에 실패했습니다' }, { status: 500 })
  }
}

// DELETE /api/landlord/properties/images?imageId=xxx
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json({ error: 'imageId가 필요합니다' }, { status: 400 })
    }

    // 소유권 확인 후 삭제
    const result = await query<ImageRow>(
      `DELETE FROM property_images pi
       USING properties p
       WHERE pi.id = $1
         AND pi.property_id = p.id
         AND p.landlord_id = $2
       RETURNING pi.*`,
      [imageId, payload.userId]
    )

    if (result.length === 0) {
      return NextResponse.json({ error: '이미지를 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('매물 이미지 삭제 오류:', error)
    return NextResponse.json({ error: '이미지 삭제에 실패했습니다' }, { status: 500 })
  }
}
