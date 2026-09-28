import { heartbeatAuthorized, monitoringConfigured, receiveHeartbeat } from '@/lib/ops-deadman'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!heartbeatAuthorized(request.headers.get('authorization'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!monitoringConfigured()) {
    return Response.json({ error: 'Monitoring unavailable' }, { status: 503 })
  }
  try {
    const receipt = await receiveHeartbeat()
    return Response.json({ receivedAt: receipt.last_received_at }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Heartbeat persistence failed' }, { status: 503 })
  }
}
