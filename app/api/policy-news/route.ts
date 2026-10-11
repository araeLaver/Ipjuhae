import { NextResponse } from 'next/server'
import { getPolicyNewsSnapshot } from '@/lib/policy-news-store'

export const dynamic = 'force-dynamic'

/** Public reads never trigger upstream collection or spend the API quota. */
export async function GET() {
  const snapshot = await getPolicyNewsSnapshot()
  return NextResponse.json(snapshot, {
    status: snapshot.health.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
