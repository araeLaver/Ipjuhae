import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

interface PropertyDetailRow {
  id: string
  landlord_id: string
  title: string
  description: string | null
  address: string
  address_detail: string | null
  region: string | null
  deposit: string
  monthly_rent: string
  maintenance_fee: string
  property_type: string
  room_count: number
  bathroom_count: number
  floor: number | null
  total_floor: number | null
  area_sqm: string | null
  options: string[]
  status: string
  available_from: string | null
  view_count: number
  created_at: string
  landlord_name: string | null
  landlord_bio: string | null
  landlord_profile_image: string | null
}

interface ImageRow {
  id: string
  image_url: string
  thumbnail_url: string | null
  sort_order: number
  is_main: boolean
}

interface FavoriteRow {
  id: string
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params

    const property = await queryOne<PropertyDetailRow>(
      `SELECT
        p.*,
        lp.name as landlord_name,
        lp.bio as landlord_bio,
        lp.profile_image_url as landlord_profile_image
      FROM properties p
      LEFT JOIN profiles lp ON lp.user_id = p.landlord_id
      WHERE p.id = $1 AND p.status != 'hidden'`,
      [propertyId]
    )

    if (!property) {
      return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
    }

    // Increment view count (fire-and-forget)
    query('UPDATE properties SET view_count = view_count + 1 WHERE id = $1', [propertyId]).catch(
      err => logger.error('조회수 증가 실패', { error: err })
    )

    // Fetch images
    const images = await query<ImageRow>(
      'SELECT id, image_url, thumbnail_url, sort_order, is_main FROM property_images WHERE property_id = $1 ORDER BY sort_order',
      [propertyId]
    )

    // Check if current user has favorited (세입자 → 이 집주인 찜 여부)
    let isFavorited = false
    const user = await getCurrentUser().catch(() => null)
    if (user && user.user_type === 'tenant') {
      const fav = await queryOne<FavoriteRow>(
        'SELECT id FROM tenant_favorites WHERE landlord_id = $1 AND tenant_id = $2',
        [property.landlord_id, user.id]
      )
      isFavorited = !!fav
    }

    return NextResponse.json({
      property: {
        id: property.id,
        landlordId: property.landlord_id,
        title: property.title,
        description: property.description,
        address: property.address,
        addressDetail: property.address_detail,
        region: property.region,
        deposit: parseInt(property.deposit),
        monthlyRent: parseInt(property.monthly_rent),
        maintenanceFee: parseInt(property.maintenance_fee),
        propertyType: property.property_type,
        roomCount: property.room_count,
        bathroomCount: property.bathroom_count,
        floor: property.floor,
        totalFloor: property.total_floor,
        areaSqm: property.area_sqm ? parseFloat(property.area_sqm) : null,
        options: property.options,
        status: property.status,
        availableFrom: property.available_from,
        viewCount: property.view_count + 1,
        createdAt: property.created_at,
        landlord: {
          name: property.landlord_name,
          bio: property.landlord_bio,
          profileImage: property.landlord_profile_image,
        },
      },
      images: images.map(img => ({
        id: img.id,
        imageUrl: img.image_url,
        thumbnailUrl: img.thumbnail_url,
        sortOrder: img.sort_order,
        isMain: img.is_main,
      })),
      isFavorited,
    })
  } catch (error) {
    logger.error('공개 매물 상세 조회 오류', { error })
    return NextResponse.json({ error: '매물 정보를 불러오는데 실패했습니다' }, { status: 500 })
  }
}
