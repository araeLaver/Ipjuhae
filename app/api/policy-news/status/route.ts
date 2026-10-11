import { NextResponse } from 'next/server'
import { getPolicyNewsStatus } from '@/lib/policy-news-store'

export const dynamic = 'force-dynamic'
export async function GET() {
  const health = await getPolicyNewsStatus()
  return NextResponse.json(health, { status: health.status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
