import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { z } from 'zod'
import { sanitizeUserInput } from '@/lib/sanitize'

// 매물 생성/수정 스키마
const propertySchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(100, '제목은 100자 이내로 입력해주세요'),
  description: z.string().max(2000, '설명은 2000자 이내로 입력해주세요').optional(),
  address: z.string().min(1, '주소를 입력해주세요').max(200, '주소는 200자 이내로 입력해주세요'),
  addressDetail: z.string().max(100).optional(),
  region: z.string().max(50).optional(),
  deposit: z.number().min(0, '보증금은 0 이상이어야 합니다'),
  monthlyRent: z.number().min(0, '월세는 0 이상이어야 합니다'),
  maintenanceFee: z.number().min(0).optional().default(0),
  propertyType: z.enum(['apartment', 'villa', 'officetel', 'oneroom', 'house', 'other']),
  roomCount: z.number().min(1).optional().default(1),
  bathroomCount: z.number().min(1).optional().default(1),
  floor: z.number().optional(),
  totalFloor: z.number().optional(),
  areaSqm: z.number().positive().optional(),
  options: z.array(z.string()).optional().default([]),
  availableFrom: z.string().optional(),
})

interface PropertyRow {
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
  updated_at: string
  main_image_url?: string
}

interface CountRow {
  total: string
}

interface UserRow {
  user_type: 'tenant' | 'landlord'
}

// GET /api/landlord/properties - 내 매물 목록 조회
export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || null
    const offset = (page - 1) * limit

    // 매물 목록 조회
    let queryText = `
      SELECT p.*,
        (SELECT image_url FROM property_images WHERE property_id = p.id AND is_main = TRUE LIMIT 1) as main_image_url
      FROM properties p
      WHERE p.landlord_id = $1
    `
    const queryParams: unknown[] = [payload.userId]

    if (status) {
      queryText += ` AND p.status = $${queryParams.length + 1}`
      queryParams.push(status)
    }

    queryText += ` ORDER BY p.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const properties = await query<PropertyRow>(queryText, queryParams)

    // 전체 매물 수
    let countQuery = 'SELECT COUNT(*) as total FROM properties WHERE landlord_id = $1'
    const countParams: unknown[] = [payload.userId]

    if (status) {
      countQuery += ' AND status = $2'
      countParams.push(status)
    }

    const countResult = await query<CountRow>(countQuery, countParams)
    const total = parseInt(countResult[0]?.total || '0')

    return NextResponse.json({
      properties: properties.map(p => ({
        ...p,
        deposit: parseInt(p.deposit),
        monthly_rent: parseInt(p.monthly_rent),
        maintenance_fee: parseInt(p.maintenance_fee),
        area_sqm: p.area_sqm ? parseFloat(p.area_sqm) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('매물 목록 조회 오류:', error)
    return NextResponse.json({ error: '매물 목록을 불러오는데 실패했습니다' }, { status: 500 })
  }
}

// POST /api/landlord/properties - 매물 등록
export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const validation = propertySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = validation.data

    const result = await query<PropertyRow>(
      `INSERT INTO properties (
        landlord_id, title, description, address, address_detail, region,
        deposit, monthly_rent, maintenance_fee, property_type,
        room_count, bathroom_count, floor, total_floor, area_sqm,
        options, available_from
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        payload.userId,
        sanitizeUserInput(data.title),
        data.description ? sanitizeUserInput(data.description) : null,
        sanitizeUserInput(data.address),
        data.addressDetail ? sanitizeUserInput(data.addressDetail) : null,
        data.region ? sanitizeUserInput(data.region) : null,
        data.deposit,
        data.monthlyRent,
        data.maintenanceFee,
        data.propertyType,
        data.roomCount,
        data.bathroomCount,
        data.floor,
        data.totalFloor,
        data.areaSqm,
        data.options,
        data.availableFrom || null,
      ]
    )

    const property = result[0]

    return NextResponse.json({
      property: {
        ...property,
        deposit: parseInt(property.deposit),
        monthly_rent: parseInt(property.monthly_rent),
        maintenance_fee: parseInt(property.maintenance_fee),
        area_sqm: property.area_sqm ? parseFloat(property.area_sqm) : null,
      },
    })
  } catch (error) {
    console.error('매물 등록 오류:', error)
    return NextResponse.json({ error: '매물 등록에 실패했습니다' }, { status: 500 })
  }
}
