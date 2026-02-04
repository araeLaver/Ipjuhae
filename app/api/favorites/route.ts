import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const addFavoriteSchema = z.object({
  tenantId: z.string().uuid('유효하지 않은 세입자 ID입니다'),
  note: z.string().max(200, '메모는 200자 이하로 입력해주세요').optional(),
})

interface FavoriteWithProfile {
  id: string
  tenant_id: string
  note: string | null
  created_at: string
  tenant_name: string
  age_range: string
  family_type: string
  trust_score: number
  bio: string | null
}

// GET: 즐겨찾기 목록 조회
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 집주인만 즐겨찾기 사용 가능
    if (user.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 즐겨찾기를 사용할 수 있습니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    // 즐겨찾기 목록 (프로필 정보 포함)
    const favorites = await query<FavoriteWithProfile>(
      `SELECT
        f.id,
        f.tenant_id,
        f.note,
        f.created_at,
        p.name as tenant_name,
        p.age_range,
        p.family_type,
        p.trust_score,
        p.bio
      FROM tenant_favorites f
      JOIN profiles p ON f.tenant_id = p.user_id
      WHERE f.landlord_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    )

    // 전체 개수
    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM tenant_favorites WHERE landlord_id = $1',
      [user.id]
    )

    const total = parseInt(countResult?.count || '0', 10)

    return NextResponse.json({
      favorites,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error('즐겨찾기 목록 조회 오류', { error })
    return NextResponse.json({ error: '즐겨찾기 목록 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// POST: 즐겨찾기 추가
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    if (user.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 즐겨찾기를 사용할 수 있습니다' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = addFavoriteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || '입력값을 확인해주세요' },
        { status: 400 }
      )
    }

    const { tenantId, note } = parsed.data

    // 자기 자신은 즐겨찾기 불가
    if (tenantId === user.id) {
      return NextResponse.json({ error: '자신을 즐겨찾기에 추가할 수 없습니다' }, { status: 400 })
    }

    // 세입자 존재 확인
    const tenant = await queryOne<{ id: string; user_type: string }>(
      'SELECT id, user_type FROM users WHERE id = $1',
      [tenantId]
    )

    if (!tenant) {
      return NextResponse.json({ error: '세입자를 찾을 수 없습니다' }, { status: 404 })
    }

    if (tenant.user_type !== 'tenant') {
      return NextResponse.json({ error: '세입자만 즐겨찾기에 추가할 수 있습니다' }, { status: 400 })
    }

    // 이미 즐겨찾기에 있는지 확인
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM tenant_favorites WHERE landlord_id = $1 AND tenant_id = $2',
      [user.id, tenantId]
    )

    if (existing) {
      // 메모 업데이트
      if (note !== undefined) {
        await query(
          'UPDATE tenant_favorites SET note = $1 WHERE id = $2',
          [note || null, existing.id]
        )
      }
      return NextResponse.json({ message: '즐겨찾기가 업데이트되었습니다', id: existing.id })
    }

    // 즐겨찾기 추가
    const [favorite] = await query<{ id: string }>(
      'INSERT INTO tenant_favorites (landlord_id, tenant_id, note) VALUES ($1, $2, $3) RETURNING id',
      [user.id, tenantId, note || null]
    )

    logger.info('즐겨찾기 추가', { landlordId: user.id, tenantId })

    return NextResponse.json({
      message: '즐겨찾기에 추가되었습니다',
      id: favorite.id,
    }, { status: 201 })
  } catch (error) {
    logger.error('즐겨찾기 추가 오류', { error })
    return NextResponse.json({ error: '즐겨찾기 추가 중 오류가 발생했습니다' }, { status: 500 })
  }
}

// DELETE: 즐겨찾기 삭제
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    if (user.user_type !== 'landlord') {
      return NextResponse.json({ error: '집주인만 즐겨찾기를 사용할 수 있습니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: '세입자 ID가 필요합니다' }, { status: 400 })
    }

    const result = await query(
      'DELETE FROM tenant_favorites WHERE landlord_id = $1 AND tenant_id = $2 RETURNING id',
      [user.id, tenantId]
    )

    if (result.length === 0) {
      return NextResponse.json({ error: '즐겨찾기를 찾을 수 없습니다' }, { status: 404 })
    }

    logger.info('즐겨찾기 삭제', { landlordId: user.id, tenantId })

    return NextResponse.json({ message: '즐겨찾기에서 삭제되었습니다' })
  } catch (error) {
    logger.error('즐겨찾기 삭제 오류', { error })
    return NextResponse.json({ error: '즐겨찾기 삭제 중 오류가 발생했습니다' }, { status: 500 })
  }
}
