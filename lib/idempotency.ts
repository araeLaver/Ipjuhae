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
}

function setDefaultHeaders(response: NextResponse, requestId: string, traceId: string) {
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-trace-id', traceId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

async function findRecord(namespace: string, key: string): Promise<IdempotentRequestRecord | null> {
  return queryOne<IdempotentRequestRecord>(
    `SELECT *
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

function isExpired(expiresAt: Date | string | null): boolean {
  const ts = toMs(expiresAt)
  if (!ts) return true
  return ts <= Date.now()
}

function createPendingRecord(
  namespace: string,
  key: string,
  actorUserId: string | null,
  requestId: string,
  traceId: string,
  requestHash: string,
  ttlMinutes: number,
) {
  const expiresAt = new Date(Date.now() + Math.max(1, ttlMinutes) * 60_000)
  return queryOne<IdempotentRequestRecord>(
    `INSERT INTO api_idempotency_requests
      (namespace, idempotency_key, actor_user_id, request_id, trace_id, request_hash, in_progress, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
     ON CONFLICT (namespace, idempotency_key) DO NOTHING
     RETURNING *`,
    [namespace, key, actorUserId, requestId, traceId, requestHash, expiresAt]
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
) {
  const expiresAt = new Date(Date.now() + Math.max(1, ttlMinutes) * 60_000)
  await query(
    `UPDATE api_idempotency_requests
       SET in_progress = FALSE,
           request_id = $1,
           trace_id = $2,
           response_status = $3,
           response_body = $4,
           updated_at = NOW(),
           expires_at = $5
       WHERE namespace = $6
         AND idempotency_key = $7`,
    [requestId, traceId, status, payload, expiresAt, namespace, key]
  )
}

export async function withIdempotency(options: IdempotencyContext): Promise<NextResponse> {
  const key = (options.key ?? '').trim()
  if (!key) {
    return options.handler()
  }

  const { request, namespace } = options
  const ttlMinutes = options.ttlMinutes ?? 120
  const actorUserId = options.actorUserId ?? null
  const { requestId, traceId } = getRequestContext(request)
  const requestHash = await hashRequest(request)

  const existing = await findRecord(namespace, key)
  if (existing && !isExpired(existing.expires_at)) {
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

  if (existing && isExpired(existing.expires_at)) {
    await query('DELETE FROM api_idempotency_requests WHERE namespace = $1 AND idempotency_key = $2', [namespace, key])
  }

  const reserved = await createPendingRecord(
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
    if (fallback && !isExpired(fallback.expires_at)) {
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
    await completeRecord(namespace, key, requestId, traceId, 500, fallbackPayload, ttlMinutes)
    return setDefaultHeaders(NextResponse.json(fallbackPayload, { status: 500 }), requestId, traceId)
  }

  const payload = (await response.clone().json().catch(() => null)) as Record<string, unknown> | null
  await completeRecord(namespace, key, requestId, traceId, response.status, payload, ttlMinutes)

  return setDefaultHeaders(response, requestId, traceId)
}

export type { IdempotentRequestRecord }
