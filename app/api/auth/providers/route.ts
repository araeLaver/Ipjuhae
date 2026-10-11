import { NextResponse } from 'next/server'
import { getEnabledProviders } from '@/lib/oauth'

// GET /api/auth/providers — which social providers are configured (client id and secret set),
// so the login/signup UI only shows working buttons.
export async function GET() {
  return NextResponse.json({ providers: getEnabledProviders() })
}
