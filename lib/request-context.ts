import { randomUUID } from 'crypto'

export interface ApiRequestContext {
  requestId: string
  traceId: string
}

function normalizeHeaderValue(value: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function extractTraceIdFromTraceParent(traceParent: string): string | null {
  // traceparent format: 00-<trace-id>-<parent-id>-<flags>
  const parts = traceParent.split('-')
  if (parts.length < 2) return null

  const candidate = normalizeHeaderValue(parts[1])
  return candidate && candidate.length === 32 ? candidate : null
}

function generateId(prefix: string): string {
  try {
    return `${prefix}_${randomUUID()}`
  } catch {
    const fallback = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
    return `${prefix}_${fallback}`
  }
}

export function getRequestContext(request: { headers: Headers }): ApiRequestContext {
  const requestId =
    normalizeHeaderValue(request.headers.get('x-request-id'))
    || normalizeHeaderValue(request.headers.get('x-correlation-id'))
    || normalizeHeaderValue(request.headers.get('request-id'))
    || generateId('req')

  const traceId =
    normalizeHeaderValue(request.headers.get('x-trace-id'))
    || extractTraceIdFromTraceParent(normalizeHeaderValue(request.headers.get('traceparent')) ?? '')
    || requestId

  return {
    requestId,
    traceId,
  }
}

export function withRequestHeaders(target: Headers): Headers {
  const headers = new Headers(target)
  const requestId = normalizeHeaderValue(target.get('x-request-id')) || generateId('req')
  const traceId =
    normalizeHeaderValue(target.get('x-trace-id'))
    || extractTraceIdFromTraceParent(normalizeHeaderValue(target.get('traceparent')) ?? '')
    || requestId

  headers.set('x-request-id', requestId)
  headers.set('x-trace-id', traceId)

  return headers
}
