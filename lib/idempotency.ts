import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { query, queryOne } from '@/lib/db'
import { getRequestContext } from '@/lib/request-context'

interface IdempotentRequestRecord {
  namespace: string
  idempotency_key: string
  actor_user_id: string | null
  request_id: string | null
  trace_id: string | null
  request_hash: string | null
  in_progress: boolean
  response_status: number | null
  response_body: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
  expires_at: Date
  expired?: boolean
}

function setDefaultHeaders(response: NextResponse, requestId: string, traceId: string) {
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-trace-id', traceId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

async function findRecord(namespace: string, key: string): Promise<IdempotentRequestRecord | null> {
  return queryOne<IdempotentRequestRecord>(
    `SELECT *, expires_at <= NOW() AS expired
       FROM api_idempotency_requests
      WHERE namespace = $1
        AND idempotency_key = $2`,
    [namespace, key]
  )
}

function toDate(value: Date | string | null): Date | null {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function toMs(value: Date | string | null): number | null {
  const date = toDate(value)
  if (!date) return null
  return date.getTime()
}

function isExpired(record: IdempotentRequestRecord): boolean {
  if (typeof record.expired === 'boolean') return record.expired
  const ts = toMs(record.expires_at)
  if (!ts) return true
  return ts <= Date.now()
}

function reserveRecord(
  namespace: string,
  key: string,
  actorUserId: string | null,
  requestId: string,
  traceId: string,
  requestHash: string,
  ttlMinutes: number,
) {
  const ttl = Math.max(1, Math.ceil(ttlMinutes))
  return queryOne<IdempotentRequestRecord>(
    `INSERT INTO api_idempotency_requests
      (namespace, idempotency_key, actor_user_id, request_id, trace_id, request_hash,
       in_progress, response_status, response_body, created_at, updated_at, expires_at)
     VALUES (
       $1, $2, $3, $4, $5, $6, TRUE, NULL, NULL,
       NOW(), NOW(), NOW() + make_interval(mins => $7::int)
     )
     ON CONFLICT (namespace, idempotency_key) DO UPDATE
       SET actor_user_id = EXCLUDED.actor_user_id,
           request_id = EXCLUDED.request_id,
           trace_id = EXCLUDED.trace_id,
           request_hash = EXCLUDED.request_hash,
           in_progress = TRUE,
           response_status = NULL,
           response_body = NULL,
           created_at = EXCLUDED.created_at,
           updated_at = EXCLUDED.updated_at,
           expires_at = EXCLUDED.expires_at
       WHERE api_idempotency_requests.expires_at <= NOW()
     RETURNING *`,
    [namespace, key, actorUserId, requestId, traceId, requestHash, ttl]
  )
}

async function hashRequest(request: Request): Promise<string> {
  const url = new URL(request.url)
  const body = await request.clone().arrayBuffer()
  return createHash('sha256')
    .update(request.method)
    .update('\n')
    .update(url.pathname)
    .update('\n')
    .update(Buffer.from(body))
    .digest('hex')
}

interface IdempotencyContext {
  request: Request
  namespace: string
  key: string | null
  actorUserId?: string | null
  ttlMinutes?: number
  nonCacheableStatuses?: readonly number[]
  handler: () => Promise<NextResponse>
}

function buildBusyResponse(
  request: Request,
  existing: IdempotentRequestRecord
) {
  const { requestId, traceId } = getRequestContext(request)
  const retryAt = toMs(existing.expires_at)
  return setDefaultHeaders(
    NextResponse.json(
      {
        error: 'Another request is already processing for this idempotency key',
        code: 'IDEMPOTENCY_IN_PROGRESS',
        request_id: existing.request_id ?? requestId,
        trace_id: existing.trace_id ?? traceId,
        retry_after: retryAt ? new Date(retryAt).toISOString() : null,
      },
      { status: 409 }
    ),
    existing.request_id ?? requestId,
    existing.trace_id ?? traceId,
  )
}

function buildCachedResponse(
  request: Request,
  existing: IdempotentRequestRecord
) {
  const { requestId, traceId } = getRequestContext(request)
  const status = existing.response_status ?? 200
  const payload = existing.response_body ?? {
    error: 'Cached idempotent response is unavailable',
    code: 'IDEMPOTENCY_CACHE_MISSING',
    request_id: requestId,
    trace_id: traceId,
  }
  const response = NextResponse.json(payload, { status })
  return setDefaultHeaders(
    response,
    existing.request_id ?? requestId,
    existing.trace_id ?? traceId
  )
}

function buildPayloadMismatchResponse(request: Request, existing: IdempotentRequestRecord) {
  const { requestId, traceId } = getRequestContext(request)
  return setDefaultHeaders(
    NextResponse.json(
      {
        error: 'This idempotency key was already used for a different request',
        code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        request_id: requestId,
        trace_id: traceId,
      },
      { status: 409 }
    ),
    requestId,
    traceId,
  )
}

async function completeRecord(
  namespace: string,
  key: string,
  requestId: string,
  traceId: string,
  status: number,
  payload: Record<string, unknown> | null,
  ttlMinutes: number,
  reservationCreatedAt: Date | string,
  requestHash: string,
) {
  const ttl = Math.max(1, Math.ceil(ttlMinutes))
  await query(
    `UPDATE api_idempotency_requests
       SET in_progress = FALSE,
           request_id = $1,
           trace_id = $2,
           response_status = $3,
           response_body = $4,
           updated_at = NOW(),
           expires_at = NOW() + make_interval(mins => $5::int)
       WHERE namespace = $6
         AND idempotency_key = $7
         AND created_at = $8
         AND request_hash = $9
         AND in_progress = TRUE`,
    [
      requestId,
      traceId,
      status,
      payload,
      ttl,
      namespace,
      key,
      reservationCreatedAt,
      requestHash,
    ]
  )
}

async function releasePendingRecord(
  namespace: string,
  key: string,
  reservationCreatedAt: Date | string,
  requestHash: string,
) {
  await query(
    `DELETE FROM api_idempotency_requests
      WHERE namespace = $1
        AND idempotency_key = $2
        AND created_at = $3
        AND request_hash = $4
        AND in_progress = TRUE`,
    [namespace, key, reservationCreatedAt, requestHash]
  )
}

export async function withIdempotency(options: IdempotencyContext): Promise<NextResponse> {
  const suppliedKey = (options.key ?? '').trim()
  if (!suppliedKey) {
    return options.handler()
  }

  const { request, namespace } = options
  const ttlMinutes = options.ttlMinutes ?? 120
  const actorUserId = options.actorUserId ?? null
  const actorScope = actorUserId ?? `anonymous:${new URL(request.url).pathname}`
  const key = createHash('sha256')
    .update(actorScope)
    .update('\0')
    .update(suppliedKey)
    .digest('hex')
  const { requestId, traceId } = getRequestContext(request)
  const requestHash = await hashRequest(request)

  let existing = await findRecord(namespace, key)
  if (!existing || isExpired(existing)) {
    const legacy = await findRecord(namespace, suppliedKey)
    if (
      legacy &&
      !isExpired(legacy) &&
      legacy.actor_user_id === actorUserId &&
      legacy.request_hash === requestHash
    ) {
      existing = legacy
    }
  }
  if (existing && !isExpired(existing)) {
    if (existing.request_hash && existing.request_hash !== requestHash) {
      return buildPayloadMismatchResponse(request, existing)
    }
    if (existing.in_progress) {
      return buildBusyResponse(request, existing)
    }
    if (existing.response_status) {
      return buildCachedResponse(request, existing)
    }
  }

  const reserved = await reserveRecord(
    namespace,
    key,
    actorUserId,
    requestId,
    traceId,
    requestHash,
    ttlMinutes,
  )
  if (!reserved) {
    const fallback = await findRecord(namespace, key)
    if (fallback && !isExpired(fallback)) {
      if (fallback.request_hash && fallback.request_hash !== requestHash) {
        return buildPayloadMismatchResponse(request, fallback)
      }
      if (fallback.in_progress) {
        return buildBusyResponse(request, fallback)
      }
      if (fallback.response_status) {
        return buildCachedResponse(request, fallback)
      }
    }
    return setDefaultHeaders(
      NextResponse.json(
        {
          error: 'Unable to acquire idempotency lock',
          code: 'IDEMPOTENCY_ACQUIRE_FAILED',
          request_id: requestId,
          trace_id: traceId,
        },
        { status: 409 }
      ),
      requestId,
      traceId,
    )
  }

  let response: NextResponse
  try {
    response = await options.handler()
  } catch (error) {
    const fallbackPayload: Record<string, unknown> = {
      error: 'Failed to process idempotent request',
      code: 'IDEMPOTENCY_EXECUTION_FAILED',
      request_id: requestId,
      trace_id: traceId,
    }
    await completeRecord(
      namespace,
      key,
      requestId,
      traceId,
      500,
      fallbackPayload,
      ttlMinutes,
      reserved.created_at,
      requestHash,
    )
    return setDefaultHeaders(NextResponse.json(fallbackPayload, { status: 500 }), requestId, traceId)
  }

  const payload = (await response.clone().json().catch(() => null)) as Record<string, unknown> | null
  if (options.nonCacheableStatuses?.includes(response.status)) {
    await releasePendingRecord(namespace, key, reserved.created_at, requestHash)
    return setDefaultHeaders(response, requestId, traceId)
  }
  await completeRecord(
    namespace,
    key,
    requestId,
    traceId,
    response.status,
    payload,
    ttlMinutes,
    reserved.created_at,
    requestHash,
  )

  return setDefaultHeaders(response, requestId, traceId)
}

export type { IdempotentRequestRecord }
