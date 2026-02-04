import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { z } from 'zod'
import { sanitizeUserInput } from '@/lib/sanitize'

// 매물 수정 스키마
const updatePropertySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  address: z.string().min(1).max(200).optional(),
  addressDetail: z.string().max(100).optional(),
  region: z.string().max(50).optional(),
  deposit: z.number().min(0).optional(),
  monthlyRent: z.number().min(0).optional(),
  maintenanceFee: z.number().min(0).optional(),
  propertyType: z.enum(['apartment', 'villa', 'officetel', 'oneroom', 'house', 'other']).optional(),
  roomCount: z.number().min(1).optional(),
  bathroomCount: z.number().min(1).optional(),
  floor: z.number().optional(),
  totalFloor: z.number().optional(),
  areaSqm: z.number().positive().optional(),
  options: z.array(z.string()).optional(),
  status: z.enum(['available', 'reserved', 'rented', 'hidden']).optional(),
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

// GET /api/landlord/properties/[id] - 매물 상세 조회
export async function GET(
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

    // 매물 조회 (본인 소유만)
    const propertyResult = await query<PropertyRow>(
      'SELECT * FROM properties WHERE id = $1 AND landlord_id = $2',
      [propertyId, payload.userId]
    )

    if (propertyResult.length === 0) {
      return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
    }

    // 이미지 조회
    const images = await query<ImageRow>(
      'SELECT * FROM property_images WHERE property_id = $1 ORDER BY sort_order',
      [propertyId]
    )

    const property = propertyResult[0]

    return NextResponse.json({
      property: {
        ...property,
        deposit: parseInt(property.deposit),
        monthly_rent: parseInt(property.monthly_rent),
        maintenance_fee: parseInt(property.maintenance_fee),
        area_sqm: property.area_sqm ? parseFloat(property.area_sqm) : null,
      },
      images,
    })
  } catch (error) {
    console.error('매물 조회 오류:', error)
    return NextResponse.json({ error: '매물을 불러오는데 실패했습니다' }, { status: 500 })
  }
}

// PUT /api/landlord/properties/[id] - 매물 수정
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
    const validation = updatePropertySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const data = validation.data

    // 동적으로 업데이트 쿼리 생성
    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(sanitizeUserInput(data.title))
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(data.description ? sanitizeUserInput(data.description) : null)
    }
    if (data.address !== undefined) {
      updates.push(`address = $${paramIndex++}`)
      values.push(sanitizeUserInput(data.address))
    }
    if (data.addressDetail !== undefined) {
      updates.push(`address_detail = $${paramIndex++}`)
      values.push(data.addressDetail ? sanitizeUserInput(data.addressDetail) : null)
    }
    if (data.region !== undefined) {
      updates.push(`region = $${paramIndex++}`)
      values.push(data.region ? sanitizeUserInput(data.region) : null)
    }
    if (data.deposit !== undefined) {
      updates.push(`deposit = $${paramIndex++}`)
      values.push(data.deposit)
    }
    if (data.monthlyRent !== undefined) {
      updates.push(`monthly_rent = $${paramIndex++}`)
      values.push(data.monthlyRent)
    }
    if (data.maintenanceFee !== undefined) {
      updates.push(`maintenance_fee = $${paramIndex++}`)
      values.push(data.maintenanceFee)
    }
    if (data.propertyType !== undefined) {
      updates.push(`property_type = $${paramIndex++}`)
      values.push(data.propertyType)
    }
    if (data.roomCount !== undefined) {
      updates.push(`room_count = $${paramIndex++}`)
      values.push(data.roomCount)
    }
    if (data.bathroomCount !== undefined) {
      updates.push(`bathroom_count = $${paramIndex++}`)
      values.push(data.bathroomCount)
    }
    if (data.floor !== undefined) {
      updates.push(`floor = $${paramIndex++}`)
      values.push(data.floor)
    }
    if (data.totalFloor !== undefined) {
      updates.push(`total_floor = $${paramIndex++}`)
      values.push(data.totalFloor)
    }
    if (data.areaSqm !== undefined) {
      updates.push(`area_sqm = $${paramIndex++}`)
      values.push(data.areaSqm)
    }
    if (data.options !== undefined) {
      updates.push(`options = $${paramIndex++}`)
      values.push(data.options)
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(data.status)
    }
    if (data.availableFrom !== undefined) {
      updates.push(`available_from = $${paramIndex++}`)
      values.push(data.availableFrom || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: '수정할 내용이 없습니다' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(propertyId)

    const result = await query<PropertyRow>(
      `UPDATE properties SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
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
    console.error('매물 수정 오류:', error)
    return NextResponse.json({ error: '매물 수정에 실패했습니다' }, { status: 500 })
  }
}

// DELETE /api/landlord/properties/[id] - 매물 삭제
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

    // 매물 삭제 (본인 소유만)
    const result = await query<PropertyRow>(
      'DELETE FROM properties WHERE id = $1 AND landlord_id = $2 RETURNING id',
      [propertyId, payload.userId]
    )

    if (result.length === 0) {
      return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('매물 삭제 오류:', error)
    return NextResponse.json({ error: '매물 삭제에 실패했습니다' }, { status: 500 })
  }
}
