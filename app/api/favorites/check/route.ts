import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET: 특정 세입자가 즐겨찾기에 있는지 확인
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    if (user.user_type !== 'landlord') {
      return NextResponse.json({ isFavorited: false })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: '세입자 ID가 필요합니다' }, { status: 400 })
    }

    const favorite = await queryOne<{ id: string; note: string | null }>(
      'SELECT id, note FROM tenant_favorites WHERE landlord_id = $1 AND tenant_id = $2',
      [user.id, tenantId]
    )

    return NextResponse.json({
      isFavorited: !!favorite,
      favoriteId: favorite?.id,
      note: favorite?.note,
    })
  } catch (error) {
    return NextResponse.json({ error: '확인 중 오류가 발생했습니다' }, { status: 500 })
  }
}
