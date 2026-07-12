import { NextResponse } from 'next/server'
import { getRequestContext } from './request-context'

interface ApiEnvelopeBase {
  request_id: string
  trace_id: string
}

function withBaseHeaders(response: NextResponse, requestId: string, traceId: string): NextResponse {
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-trace-id', traceId)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export function jsonSuccess<T>(
  request: { headers: Headers },
  payload: T,
  status = 200,
): NextResponse {
  const { requestId, traceId } = getRequestContext(request)
  const responseBody = {
    ...(payload as Record<string, unknown>),
    request_id: requestId,
    trace_id: traceId,
  }

  return withBaseHeaders(NextResponse.json(responseBody, { status }), requestId, traceId)
}

export function jsonError(
  request: { headers: Headers },
  status: number,
  error: string,
  code?: string,
): NextResponse {
  const { requestId, traceId } = getRequestContext(request)
  const responseBody: ApiEnvelopeBase & { error: string; code?: string } = {
    request_id: requestId,
    trace_id: traceId,
    error,
    ...(code ? { code } : {}),
  }

  return withBaseHeaders(NextResponse.json(responseBody, { status }), requestId, traceId)
}

export type ApiEnvelope = ApiEnvelopeBase & Record<string, unknown>
