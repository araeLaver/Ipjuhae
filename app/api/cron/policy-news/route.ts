import { NextResponse } from 'next/server'
import { getPolicyNewsStatus, refreshPolicyNews } from '@/lib/policy-news-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const refresh = await refreshPolicyNews()
    const health = await getPolicyNewsStatus()
    const failed = (refresh && 'complete' in refresh && !refresh.complete) || health.status !== 'ok'
    return NextResponse.json({ refresh, health }, { status: failed ? 503 : 200 })
  } catch {
    return NextResponse.json({ error: 'POLICY_REFRESH_FAILED' }, { status: 503 })
  }
}
