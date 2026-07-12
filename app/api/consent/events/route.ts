import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { ConsentPurpose, ConsentTargetRole, ConsentEvent } from '@/types/database'
import { jsonError, jsonSuccess } from '@/lib/api-response'
import { decodeCursor, encodeCursor } from '@/lib/pagination-cursor'

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

function isConsentTargetRole(value: string | null): value is ConsentTargetRole {
  return value === 'tenant' || value === 'landlord' || value === 'broker' || value === 'admin'
}

function isConsentPurpose(value: string | null): value is ConsentPurpose {
  return value === 'tenant_profile_view' || value === 'landlord_profile_view' || value === 'property_view'
}

function isEventType(value: string | null): value is 'granted' | 'updated' | 'revoked' {
  return value === 'granted' || value === 'updated' || value === 'revoked'
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return jsonError(request, 401, 'Authentication required', 'AUTH_REQUIRED')
  }

  const url = new URL(request.url)
  const search = url.searchParams

  const consentId = search.get('consentId')?.trim() || null
  const targetRole = search.get('targetRole')
  const purpose = search.get('purpose')
  const eventType = search.get('eventType')

  const targetRoleFilter = targetRole && isConsentTargetRole(targetRole) ? targetRole : null
  const purposeFilter = purpose && isConsentPurpose(purpose) ? purpose : null
  const eventTypeFilter = eventType && isEventType(eventType) ? eventType : null

  if (targetRole && !targetRoleFilter) {
    return jsonError(request, 400, 'Invalid targetRole filter', 'INVALID_FILTER')
  }
  if (purpose && !purposeFilter) {
    return jsonError(request, 400, 'Invalid purpose filter', 'INVALID_FILTER')
  }
  if (eventType && !eventTypeFilter) {
    return jsonError(request, 400, 'Invalid eventType filter', 'INVALID_FILTER')
  }

  const limit = parsePositiveInt(search.get('limit'), 50, 200)
  const cursorPayload = decodeCursor(search.get('cursor'))
  const useCursor = Boolean(cursorPayload)
  const offset = useCursor ? 0 : parseOffset(search.get('offset'), 0)

  const where: string[] = ['user_id = $1']
  const params: Array<string | number | boolean> = [user.id]
  let idx = 2

  if (targetRoleFilter) {
    where.push(`target_role = $${idx}`)
    params.push(targetRoleFilter)
    idx += 1
  }

  if (purposeFilter) {
    where.push(`purpose = $${idx}`)
    params.push(purposeFilter)
    idx += 1
  }

  if (eventTypeFilter) {
    where.push(`event_type = $${idx}`)
    params.push(eventTypeFilter)
    idx += 1
  }

  if (consentId) {
    where.push(`data_consent_id = $${idx}`)
    params.push(consentId)
    idx += 1
  }

  const whereSql = `WHERE ${where.join(' AND ')}`

  const [countRow] = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM consent_events ${whereSql}`,
    params
  )
  const total = Number.parseInt(countRow?.count ?? '0', 10)

  const pageWhere = [...where]
  const pageParams: Array<string | number | boolean> = [...params]
  let pageIdx = idx
  if (useCursor && cursorPayload) {
    pageWhere.push(`(created_at < $${pageIdx} OR (created_at = $${pageIdx} AND id < $${pageIdx + 1}))`)
    pageParams.push(cursorPayload.createdAt, cursorPayload.id)
    pageIdx += 2
  }

  const pageWhereSql = `WHERE ${pageWhere.join(' AND ')}`

  const events = await query<ConsentEvent>(
    `SELECT * FROM consent_events
       ${pageWhereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${pageIdx} OFFSET $${pageIdx + 1}`,
    [...pageParams, limit + 1, offset]
  )

  const hasMore = events.length > limit
  const eventsPage = hasMore ? events.slice(0, limit) : events
  const nextCursor = hasMore
    ? encodeCursor(events[eventsPage.length - 1].created_at, events[eventsPage.length - 1].id)
    : null

  return jsonSuccess(request, {
    events: eventsPage,
    pagination: {
      limit,
      offset,
      total,
      hasMore: useCursor ? hasMore : offset + eventsPage.length < total,
      nextCursor,
    },
    filters: {
      targetRole,
      purpose,
      eventType,
      consentId,
    },
  })
}
