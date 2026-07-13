import { getCurrentUser } from '@/lib/auth'
import { getPublicTrustCard } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  if (token.length < 20 || token.length > 100) {
    return jsonError(request, 400, 'Invalid Trust Card token', 'INVALID_TOKEN')
  }
  const user = await getCurrentUser()
  const url = new URL(request.url)
  try {
    const data = await getPublicTrustCard(
      token,
      user?.id ?? null,
      url.searchParams.get('purpose'),
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      request.headers.get('user-agent')
    )
    return jsonSuccess(request, data)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'TRUST_CARD_ACCESS_FAILED'
    const status = code.endsWith('NOT_FOUND') ? 404 : code.endsWith('EXPIRED') || code.endsWith('REVOKED') ? 410 : 500
    return jsonError(request, status, 'Trust Card is unavailable', code)
  }
}

