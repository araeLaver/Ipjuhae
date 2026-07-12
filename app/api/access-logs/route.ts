import { query, queryOne } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { AccessTargetType, User, AccessAuditLog } from '@/types/database'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { decodeCursor, encodeCursor } from '@/lib/pagination-cursor'

type AccessTargetTypeFilter = AccessTargetType | 'all'

const ALLOWED_TARGET_TYPES: AccessTargetType[] = ['tenant_profile', 'landlord_profile', 'property']

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  if (max && parsed > max) return max
  return parsed
}

function parseOffset(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: Request) {
  const actor = await getCurrentUser()
  if (!actor) {
    return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  try {
    const actorProfile = await queryOne<User>(
      'SELECT id, user_type FROM users WHERE id = $1',
      [actor.id]
    )

    const url = new URL(request.url)
    const search = url.searchParams

    const targetTypeRaw = search.get('targetType')
    const targetType = (targetTypeRaw as AccessTargetTypeFilter) ?? 'all'
    if (targetTypeRaw && !ALLOWED_TARGET_TYPES.includes(targetType as AccessTargetType)) {
      return jsonError(request, 400, 'Invalid targetType filter', 'INVALID_FILTER')
    }

    const targetUserId = search.get('targetUserId')?.trim() || null
    const actorUserId = search.get('actorUserId')?.trim() || null
    const purpose = search.get('purpose')?.trim() || null
    const contractId = search.get('contractId')?.trim() || null

    const from = parseDate(search.get('from'))
    const to = parseDate(search.get('to'))
    const limit = parsePositiveInt(search.get('limit'), 50, 200)
    const cursorPayload = decodeCursor(search.get('cursor'))
    const useCursor = Boolean(cursorPayload)
    const offset = useCursor ? 0 : parseOffset(search.get('offset'), 0)

    const where: string[] = []
    const params: Array<string | number | boolean | Date | null> = []
    let idx = 1

    if (actorProfile?.user_type !== 'admin') {
      where.push(`(actor_user_id = $${idx} OR target_user_id = $${idx})`)
      params.push(actor.id)
      idx += 1
    }

    if (targetType !== 'all') {
      where.push(`target_type = $${idx}`)
      params.push(targetType)
      idx += 1
    }

    if (targetUserId) {
      where.push(`target_user_id = $${idx}`)
      params.push(targetUserId)
      idx += 1
    }

    if (actorUserId) {
      where.push(`actor_user_id = $${idx}`)
      params.push(actorUserId)
      idx += 1
    }

    if (purpose) {
      where.push(`purpose = $${idx}`)
      params.push(purpose)
      idx += 1
    }

    if (contractId) {
      where.push(`contract_id = $${idx}`)
      params.push(contractId)
      idx += 1
    }

    if (from) {
      where.push(`created_at >= $${idx}`)
      params.push(from)
      idx += 1
    }

    if (to) {
      where.push(`created_at <= $${idx}`)
      params.push(to)
      idx += 1
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [countRow] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM access_audit_logs ${whereSql}`,
      [...params]
    )
    const total = Number.parseInt(countRow?.count ?? '0', 10)

    const pageWhere = [...where]
    const pageParams: Array<string | number | boolean | Date | null> = [...params]
    let pageIdx = idx
    if (useCursor && cursorPayload) {
      pageWhere.push(`(created_at < $${pageIdx} OR (created_at = $${pageIdx} AND id < $${pageIdx + 1}))`)
      pageParams.push(cursorPayload.createdAt, cursorPayload.id)
      pageIdx += 2
    }

    const pageWhereSql = pageWhere.length ? `WHERE ${pageWhere.join(' AND ')}` : ''
    const logs = await query<AccessAuditLog>(
      `SELECT * FROM access_audit_logs ${pageWhereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${pageIdx} OFFSET $${pageIdx + 1}`,
      [...pageParams, limit + 1, offset]
    )

    const hasMore = logs.length > limit
    const logsPage = hasMore ? logs.slice(0, limit) : logs
    const nextCursor = hasMore
      ? encodeCursor(logs[logsPage.length - 1].created_at, logs[logsPage.length - 1].id)
      : null

    return jsonSuccess(request, {
      logs: logsPage,
      pagination: {
        limit,
        offset,
        total,
        hasMore: useCursor ? hasMore : offset + logsPage.length < total,
        nextCursor,
      },
      filters: {
        targetType,
        targetUserId,
        actorUserId,
        purpose,
        contractId,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
    })
  } catch (error) {
    console.error('Get access logs error:', error)
    return jsonError(request, 500, 'Failed to load access logs', 'ACCESS_LOGS_FAILED')
  }
}
