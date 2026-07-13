import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { addOrganizationMember } from '@/lib/contract-trust'
import { jsonError, jsonSuccess } from '@/lib/api-response'

const schema = z.object({
  userId: z.string().uuid(),
  memberRole: z.enum(['admin', 'reviewer', 'broker', 'member']),
})

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const { id } = await context.params
  const members = await query(
    'SELECT membership.id, membership.user_id, membership.member_role, membership.status, membership.created_at, user_row.email, user_row.name ' +
    'FROM trust_organization_memberships membership JOIN users user_row ON user_row.id = membership.user_id ' +
    'WHERE membership.organization_id = $1 AND EXISTS (' +
    'SELECT 1 FROM trust_organization_memberships own WHERE own.organization_id = $1 AND own.user_id = $2 AND own.status = \'active\') ' +
    'ORDER BY membership.created_at',
    [id, user.id]
  )
  return jsonSuccess(request, { members })
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return jsonError(request, 400, 'Invalid member payload', 'INVALID_PAYLOAD')
  const { id } = await context.params
  try {
    const member = await addOrganizationMember(user.id, id, parsed.data.userId, parsed.data.memberRole)
    return jsonSuccess(request, { member }, 201)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ORGANIZATION_MEMBER_FAILED'
    return jsonError(request, code.endsWith('REQUIRED') ? 403 : 500, 'Failed to add organization member', code)
  }
}

