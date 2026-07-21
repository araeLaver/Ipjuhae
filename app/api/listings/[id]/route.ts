import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { type Listing } from '@/lib/schemas/listing'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)

    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 })
    }

    const listing = await queryOne<Listing>(
      'SELECT * FROM listings WHERE id = $1',
      [numId]
    )

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({ listing })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load listing detail now' },
      { status: 500 }
    )
  }
}
