import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { verifyAndReadDisclosurePackage } from '@/lib/trust-engine'
import { getRequestContext } from '@/lib/request-context'
import { jsonError, jsonSuccess } from '@/lib/api-response'

const schema = z.object({
  accessToken: z.string().min(10).max(4096),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return jsonError(request, 400, parsed.error.issues[0]?.message ?? 'Invalid payload', 'INVALID_PAYLOAD')
  }

  try {
    const result = await verifyAndReadDisclosurePackage(
      id,
      parsed.data.accessToken,
      user.id,
      getRequestContext(request)
    )
    if (!result.allowed) {
      return jsonError(request, 403, 'Disclosure access denied', result.reason)
    }
    return jsonSuccess(request, { payload: result.payload })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DISCLOSURE_VERIFY_FAILED'
    const status =
      code.includes('FORBIDDEN') ? 403 :
        code.includes('NOT_FOUND') ? 404 :
          code.includes('NOT_CONFIGURED') ? 503 : 500
    return jsonError(request, status, 'Failed to verify disclosure access', code)
  }
}
