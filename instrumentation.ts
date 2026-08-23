// Next.js instrumentation.
// Sentry SDK stays intentionally absent (its build-time webpack plugin caused
// compile timeouts on the small instance). Server error capture is handled by
// the `onRequestError` hook below, which routes through lib/observability's
// captureError — structured logging always, Sentry forwarding when SENTRY_DSN
// is set. See lib/observability.ts.

export async function register() {
  // noop — fast startup
}

type RequestErrorRequest = {
  path?: string
  method?: string
  headers?: Record<string, string | string[] | undefined>
}

type RequestErrorContext = {
  routerKind?: string
  routePath?: string
  routeType?: string
  renderSource?: string
}

export async function onRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
): Promise<void> {
  // Only the Node runtime can safely reach the logger/fetch forwarder.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { captureError } = await import('./lib/observability')
  const headers = request.headers || {}
  const requestId = headers['x-request-id']
  await captureError(error, {
    route: request.path,
    method: request.method,
    requestId: Array.isArray(requestId) ? requestId[0] : requestId,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  })
}
