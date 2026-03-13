import { NextResponse } from 'next/server'
import { mockListings } from '@/lib/mock-listings'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)

    if (isNaN(numId)) {
      return NextResponse.json({ error: '잘못된 매물 ID입니다' }, { status: 400 })
    }

    const listing = mockListings.find((l) => l.id === numId)

    if (!listing) {
      return NextResponse.json({ error: '매물을 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ listing })
  } catch {
    return NextResponse.json(
      { error: '매물 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
