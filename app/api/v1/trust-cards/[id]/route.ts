import { getCurrentUser } from '@/lib/auth'
import { revokeTrustCard } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await context.params
  try {
    return jsonSuccess(request, { card: await revokeTrustCard(user.id, id) })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'TRUST_CARD_REVOKE_FAILED'
    return jsonError(request, code.endsWith('NOT_FOUND') ? 404 : 500, 'Failed to revoke Trust Card', code)
  }
}

