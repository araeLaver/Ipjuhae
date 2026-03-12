import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logger } from '@/lib/logger'

interface PropertyListRow {
  id: string
  title: string
  address: string
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
  available_from: string | null
  view_count: number
  created_at: string
  main_image_url: string | null
  landlord_name: string | null
}

const ALLOWED_SORT = ['created_at', 'deposit', 'monthly_rent', 'view_count'] as const
type SortField = (typeof ALLOWED_SORT)[number]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Filters
    const region = searchParams.get('region')
    const propertyType = searchParams.get('type')
    const minDeposit = searchParams.get('minDeposit') ? parseInt(searchParams.get('minDeposit')!) : null
    const maxDeposit = searchParams.get('maxDeposit') ? parseInt(searchParams.get('maxDeposit')!) : null
    const minRent = searchParams.get('minRent') ? parseInt(searchParams.get('minRent')!) : null
    const maxRent = searchParams.get('maxRent') ? parseInt(searchParams.get('maxRent')!) : null
    const options = searchParams.get('options')?.split(',').filter(Boolean) || []
    const q = searchParams.get('q')?.trim()

    // Pagination (cursor-based)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    // Sort
    const sortParam = searchParams.get('sort') || 'created_at'
    const sort: SortField = ALLOWED_SORT.includes(sortParam as SortField)
      ? (sortParam as SortField)
      : 'created_at'
    const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC'

    const conditions: string[] = [`p.status = 'available'`]
    const values: unknown[] = []
    let idx = 1

    if (region) {
      conditions.push(`p.region = $${idx++}`)
      values.push(region)
    }
    if (propertyType) {
      const VALID_TYPES = ['apartment', 'villa', 'officetel', 'oneroom', 'house', 'other']
      if (VALID_TYPES.includes(propertyType)) {
        conditions.push(`p.property_type = $${idx++}`)
        values.push(propertyType)
      }
    }
    if (minDeposit !== null) {
      conditions.push(`p.deposit >= $${idx++}`)
      values.push(minDeposit)
    }
    if (maxDeposit !== null) {
      conditions.push(`p.deposit <= $${idx++}`)
      values.push(maxDeposit)
    }
    if (minRent !== null) {
      conditions.push(`p.monthly_rent >= $${idx++}`)
      values.push(minRent)
    }
    if (maxRent !== null) {
      conditions.push(`p.monthly_rent <= $${idx++}`)
      values.push(maxRent)
    }
    if (options.length > 0) {
      conditions.push(`p.options @> $${idx++}`)
      values.push(JSON.stringify(options))
    }
    if (q) {
      conditions.push(`(p.title ILIKE $${idx} OR p.address ILIKE $${idx})`)
      values.push(`%${q}%`)
      idx++
    }
    if (cursor) {
      conditions.push(`p.${sort} ${order === 'DESC' ? '<' : '>'} $${idx++}`)
      values.push(cursor)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    values.push(limit + 1)
    const limitIdx = idx

    const rows = await query<PropertyListRow>(
      `SELECT
        p.id,
        p.title,
        p.address,
        p.region,
        p.deposit,
        p.monthly_rent,
        p.maintenance_fee,
        p.property_type,
        p.room_count,
        p.bathroom_count,
        p.floor,
        p.total_floor,
        p.area_sqm,
        p.options,
        p.available_from,
        p.view_count,
        p.created_at,
        pi.image_url as main_image_url,
        lp.name as landlord_name
      FROM properties p
      LEFT JOIN property_images pi ON pi.property_id = p.id AND pi.is_main = TRUE
      LEFT JOIN profiles lp ON lp.user_id = p.landlord_id
      ${whereClause}
      ORDER BY p.${sort} ${order}
      LIMIT $${limitIdx}`,
      values
    )

    const hasMore = rows.length > limit
    const properties = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? properties[properties.length - 1][sort as keyof PropertyListRow] : null

    return NextResponse.json({
      properties: properties.map(p => ({
        id: p.id,
        title: p.title,
        address: p.address,
        region: p.region,
        deposit: parseInt(p.deposit),
        monthlyRent: parseInt(p.monthly_rent),
        maintenanceFee: parseInt(p.maintenance_fee),
        propertyType: p.property_type,
        roomCount: p.room_count,
        bathroomCount: p.bathroom_count,
        floor: p.floor,
        totalFloor: p.total_floor,
        areaSqm: p.area_sqm ? parseFloat(p.area_sqm) : null,
        options: p.options,
        availableFrom: p.available_from,
        viewCount: p.view_count,
        createdAt: p.created_at,
        mainImageUrl: p.main_image_url,
        landlordName: p.landlord_name,
      })),
      nextCursor,
      hasMore,
    })
  } catch (error) {
    logger.error('공개 매물 목록 조회 오류', { error })
    return NextResponse.json({ error: '매물 목록을 불러오는데 실패했습니다' }, { status: 500 })
  }
}
