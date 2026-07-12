import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getClientIp } from '@/lib/rate-limit'
import { getLandlordProfileConsent, getTenantProfileVisibility, maskProfileName, toConsentRole } from '@/lib/consent'
import { recordAccessAudit } from '@/lib/access-audit'
import { getRequestContext } from '@/lib/request-context'

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
  const { requestId, traceId } = getRequestContext(request)

  try {
    const { id: propertyId } = await params
    const actor = await getCurrentUser().catch(() => null)

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
      return NextResponse.json(
        { error: '매물을 찾을 수 없습니다', request_id: requestId, trace_id: traceId },
        { status: 404 }
      )
    }

    query('UPDATE properties SET view_count = view_count + 1 WHERE id = $1', [propertyId]).catch(
      (err) => logger.error('매물 조회 카운트 증가 실패', { error: err })
    )

    const images = await query<ImageRow>(
      'SELECT id, image_url, thumbnail_url, sort_order, is_main FROM property_images WHERE property_id = $1 ORDER BY sort_order',
      [propertyId]
    )

    let isFavorited = false
    if (actor && actor.user_type === 'tenant') {
      const fav = await queryOne<FavoriteRow>(
        'SELECT id FROM tenant_favorites WHERE landlord_id = $1 AND tenant_id = $2',
        [property.landlord_id, actor.id]
      )
      isFavorited = !!fav
    }

    const isOwner = actor?.id === property.landlord_id
    const visibility = !isOwner && actor?.user_type === 'tenant'
      ? getTenantProfileVisibility(await getLandlordProfileConsent(property.landlord_id))
      : null

    const landlord = isOwner || !visibility
      ? {
          name: property.landlord_name,
          bio: property.landlord_bio,
          profileImage: property.landlord_profile_image,
        }
      : {
          name: visibility.basic_profile
            ? property.landlord_name
            : maskProfileName(property.landlord_name ?? ''),
          bio: visibility.bio ? property.landlord_bio : null,
          profileImage: visibility.contact ? property.landlord_profile_image : null,
        }

    void recordAccessAudit({
      actorUserId: actor?.id ?? null,
      actorRole: toConsentRole(actor?.user_type),
      actorIp: getClientIp(request),
      actorUserAgent: request.headers.get('user-agent'),
      targetType: 'property',
      targetId: property.id,
      targetUserId: property.landlord_id,
      purpose: 'property_view',
      fieldsViewed: actor?.user_type === 'tenant' ? ['property', 'landlord_profile'] : ['property'],
      requestId,
      traceId,
      metadata: {
        listVisible: true,
      },
    })

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
        landlord,
      },
      images: images.map((img) => ({
        id: img.id,
        imageUrl: img.image_url,
        thumbnailUrl: img.thumbnail_url,
        sortOrder: img.sort_order,
        isMain: img.is_main,
      })),
      isFavorited,
      request_id: requestId,
      trace_id: traceId,
    })
  } catch (error) {
    console.error('매물 상세 조회 실패', error)
    return NextResponse.json(
      { error: '매물 조회 중 오류가 발생했습니다', request_id: requestId, trace_id: traceId },
      { status: 500 }
    )
  }
}
