import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { createListingSchema, type Listing } from '@/lib/schemas/listing'
import { trackServer } from '@/lib/analytics'

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getLandlordId(request: Request): Promise<{ id: number } | NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value

  if (!token) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다' }, { status: 401 })
  }

  return { id: Number(payload.userId) }
}

function isNextResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse
}

// ─── GET /api/listings ────────────────────────────────────────────────────────

export async function GET() {
  try {
    const listings = await query<Listing>(
      `SELECT * FROM listings ORDER BY created_at DESC`
    )
    return NextResponse.json({ listings })
  } catch (error) {
    console.error('[GET /api/listings]', error)
    return NextResponse.json({ error: '매물 목록을 불러오지 못했습니다' }, { status: 500 })
  }
}

// ─── POST /api/listings ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await getLandlordId(request)
    if (isNextResponse(authResult)) return authResult

    const body = await request.json()
    const parsed = createListingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const {
      monthly_rent,
      deposit,
      address,
      area_sqm,
      floor,
      photo_urls,
      available_from,
    } = parsed.data

    const rows = await query<Listing>(
      `INSERT INTO listings
         (landlord_id, monthly_rent, deposit, address, area_sqm, floor, photo_urls, available_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        authResult.id,
        monthly_rent,
        deposit,
        address,
        area_sqm ?? null,
        floor ?? null,
        photo_urls ?? [],
        available_from ?? null,
      ]
    )

    await trackServer('listing_submitted', {
      userId: String(authResult.id),
      timestamp: new Date().toISOString(),
      listing_id: rows[0].id,
      monthly_rent: monthly_rent,
      deposit: deposit,
    })

    return NextResponse.json({ listing: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/listings]', error)
    return NextResponse.json({ error: '매물 등록에 실패했습니다' }, { status: 500 })
  }
}
