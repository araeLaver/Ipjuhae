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

// POST /api/landlord/properties/[id]/images - ?´ë?ì§€ ?…ë¡œ??
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
    }

    // ì§‘ì£¼???•ì¸
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0 || userResult[0].user_type !== 'landlord') {
      return NextResponse.json({ error: 'ì§‘ì£¼?¸ë§Œ ?‘ê·¼?????ˆìŠµ?ˆë‹¤' }, { status: 403 })
    }

    // ë§¤ë¬¼ ?Œìœ ê¶??•ì¸
    const ownerCheck = await query<PropertyRow>(
      'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
      [propertyId, payload.userId]
    )

    if (ownerCheck.length === 0) {
      return NextResponse.json({ error: 'ë§¤ë¬¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const isMain = formData.get('isMain') === 'true'

    if (!file) {
      return NextResponse.json({ error: '?´ë?ì§€ ?Œì¼???„ìš”?©ë‹ˆ?? }, { status: 400 })
    }

    // ?Œì¼ ?¬ê¸° ?œí•œ (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '?Œì¼ ?¬ê¸°??10MB ?´í•˜?¬ì•¼ ?©ë‹ˆ?? }, { status: 400 })
    }

    // ?´ë?ì§€ ?€???•ì¸
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '?´ë?ì§€ ?Œì¼ë§??…ë¡œ?œí•  ???ˆìŠµ?ˆë‹¤' }, { status: 400 })
    }

    // ?´ë?ì§€ ê°œìˆ˜ ?œí•œ (ìµœë? 10ê°?
    const countResult = await query<CountRow>(
      'SELECT COUNT(*) as count FROM property_images WHERE property_id = $1',
      [propertyId]
    )
    const imageCount = parseInt(countResult[0]?.count || '0')

    if (imageCount >= 10) {
      return NextResponse.json({ error: 'ë§¤ë¬¼???´ë?ì§€??ìµœë? 10ê°œê¹Œì§€ ?±ë¡?????ˆìŠµ?ˆë‹¤' }, { status: 400 })
    }

    // ?´ë?ì§€ ì²˜ë¦¬
    const buffer = Buffer.from(await file.arrayBuffer())
    const optimizedResult = await optimizeProfileImage(buffer)
    const thumbnailResult = await createThumbnail(buffer)

    if (!optimizedResult.success || !optimizedResult.buffer) {
      return NextResponse.json({ error: '?´ë?ì§€ ìµœì ?”ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
    }

    // ?Œì¼ ?…ë¡œ??
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
      return NextResponse.json({ error: '?´ë?ì§€ ?…ë¡œ?œì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
    }

    const imageUrl = imageUploadResult.url

    // ?¤ìŒ ?•ë ¬ ?œì„œ ê°€?¸ì˜¤ê¸?
    const sortOrder = imageCount

    // ë©”ì¸ ?´ë?ì§€ ?¤ì • ??ê¸°ì¡´ ë©”ì¸ ?´ë?ì§€ ?´ì œ
    if (isMain) {
      await query(
        'UPDATE property_images SET is_main = FALSE WHERE property_id = $1',
        [propertyId]
      )
    }

    // ì²?ë²ˆì§¸ ?´ë?ì§€???ë™?¼ë¡œ ë©”ì¸?¼ë¡œ ?¤ì •
    const shouldBeMain = isMain || imageCount === 0

    // DB???´ë?ì§€ ?•ë³´ ?€??
    const result = await query<ImageRow>(
      `INSERT INTO property_images (property_id, image_url, thumbnail_url, sort_order, is_main)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [propertyId, imageUrl, thumbnailUrl, sortOrder, shouldBeMain]
    )

    return NextResponse.json({ image: result[0] })
  } catch (error) {
    console.error('?´ë?ì§€ ?…ë¡œ???¤ë¥˜:', error)
    return NextResponse.json({ error: '?´ë?ì§€ ?…ë¡œ?œì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

// DELETE /api/landlord/properties/[id]/images - ?´ë?ì§€ ?? œ
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
    }

    // ì§‘ì£¼???•ì¸
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0 || userResult[0].user_type !== 'landlord') {
      return NextResponse.json({ error: 'ì§‘ì£¼?¸ë§Œ ?‘ê·¼?????ˆìŠµ?ˆë‹¤' }, { status: 403 })
    }

    // ë§¤ë¬¼ ?Œìœ ê¶??•ì¸
    const ownerCheck = await query<PropertyRow>(
      'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
      [propertyId, payload.userId]
    )

    if (ownerCheck.length === 0) {
      return NextResponse.json({ error: 'ë§¤ë¬¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json({ error: '?´ë?ì§€ IDê°€ ?„ìš”?©ë‹ˆ?? }, { status: 400 })
    }

    // ?´ë?ì§€ ?? œ
    const result = await query<ImageRow>(
      'DELETE FROM property_images WHERE id = $1 AND property_id = $2 RETURNING is_main',
      [imageId, propertyId]
    )

    if (result.length === 0) {
      return NextResponse.json({ error: '?´ë?ì§€ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤' }, { status: 404 })
    }

    // ?? œ???´ë?ì§€ê°€ ë©”ì¸?´ì—ˆ?¤ë©´ ì²?ë²ˆì§¸ ?´ë?ì§€ë¥?ë©”ì¸?¼ë¡œ ?¤ì •
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
    console.error('?´ë?ì§€ ?? œ ?¤ë¥˜:', error)
    return NextResponse.json({ error: '?´ë?ì§€ ?? œ???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

// PUT /api/landlord/properties/[id]/images - ?´ë?ì§€ ?œì„œ/ë©”ì¸ ë³€ê²?
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ?? }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ?? }, { status: 401 })
    }

    // ì§‘ì£¼???•ì¸
    const userResult = await query<UserRow>(
      'SELECT user_type FROM users WHERE id = $1',
      [payload.userId]
    )

    if (userResult.length === 0 || userResult[0].user_type !== 'landlord') {
      return NextResponse.json({ error: 'ì§‘ì£¼?¸ë§Œ ?‘ê·¼?????ˆìŠµ?ˆë‹¤' }, { status: 403 })
    }

    // ë§¤ë¬¼ ?Œìœ ê¶??•ì¸
    const ownerCheck = await query<PropertyRow>(
      'SELECT id FROM properties WHERE id = $1 AND landlord_id = $2',
      [propertyId, payload.userId]
    )

    if (ownerCheck.length === 0) {
      return NextResponse.json({ error: 'ë§¤ë¬¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤' }, { status: 404 })
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
      // ë©”ì¸ ?´ë?ì§€ ë³€ê²?
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
    console.error('?´ë?ì§€ ?…ë°?´íŠ¸ ?¤ë¥˜:', error)
    return NextResponse.json({ error: '?´ë?ì§€ ?…ë°?´íŠ¸???¤íŒ¨?ˆìŠµ?ˆë‹¤' }, { status: 500 })
  }
}

