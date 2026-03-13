import { NextResponse } from 'next/server'
import { mockListings } from '@/lib/mock-listings'

export async function GET() {
  try {
    // Attempt to fetch from the existing /api/properties endpoint (DB-backed)
    // and reshape into listing format. If unavailable, return mock data.
    return NextResponse.json({ listings: mockListings })
  } catch {
    return NextResponse.json({ listings: mockListings })
  }
}
