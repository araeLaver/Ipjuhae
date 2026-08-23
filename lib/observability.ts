import { logger } from './logger'

export interface ErrorContext {
  route?: string
  method?: string
  requestId?: string
  [key: string]: unknown
}

/**
 * Central seam for uncaught-error capture.
 *
 * Design note: we intentionally do NOT depend on `@sentry/nextjs`. That SDK was
 * disabled previously because its build-time webpack plugin caused compile
 * timeouts on the small (nano) instance. This seam instead:
 *   1. Always records the error through the PII-redacting `logger` (structured
 *      JSON in production → visible in Fly logs). This resolves "prod runs
 *      blind" with zero build cost and no instance upgrade.
 *   2. If `SENTRY_DSN` is set, best-effort forwards the event to Sentry's
 *      envelope endpoint over plain fetch (no SDK). Any failure here is
 *      swallowed (logged as a warning) so error handling never cascades.
 *
 * To activate Sentry: set the `SENTRY_DSN` secret on the app. No code change,
 * no dependency, no build-cost change.
 */
export async function captureError(
  error: unknown,
  context: ErrorContext = {},
): Promise<void> {
  const label = context.route ? `Unhandled error @ ${context.route}` : 'Unhandled error'
  logger.error(label, { ...context, error })

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  try {
    await forwardToSentry(dsn, error, context)
  } catch (forwardError) {
    logger.warn('Sentry forward failed', { error: forwardError })
  }
}

interface ParsedDsn {
  publicKey: string
  host: string
  projectId: string
  protocol: string
}

// DSN format: <protocol>://<publicKey>@<host>[:port]/<path><projectId>
function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace(/^\/+/, '').split('/').pop() || ''
    if (!url.username || !projectId) return null
    return {
      publicKey: url.username,
      host: url.host,
      projectId,
      protocol: url.protocol.replace(':', ''),
    }
  } catch {
    return null
  }
}

function eventId(): string {
  // 32 hex chars, no dashes — Sentry event_id format.
  return globalThis.crypto.randomUUID().replace(/-/g, '')
}

async function forwardToSentry(
  dsn: string,
  error: unknown,
  context: ErrorContext,
): Promise<void> {
  const parsed = parseDsn(dsn)
  if (!parsed) {
    logger.warn('Invalid SENTRY_DSN; skipping forward')
    return
  }

  const err = error instanceof Error ? error : new Error(String(error))
  const id = eventId()
  const sentAt = new Date().toISOString()

  const event = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    logger: 'observability.captureError',
    environment: process.env.NODE_ENV || 'production',
    server_name: process.env.FLY_APP_NAME || undefined,
    release: process.env.FLY_IMAGE_REF || process.env.GIT_COMMIT || undefined,
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack ? { frames: parseStack(err.stack) } : undefined,
        },
      ],
    },
    tags: {
      route: context.route,
      method: context.method,
    },
    extra: { ...context, error: undefined },
  }

  const endpoint = `${parsed.protocol}://${parsed.host}/api/${parsed.projectId}/envelope/`
  const auth = [
    'Sentry sentry_version=7',
    'sentry_client=ipjuhae-observability/1.0',
    `sentry_key=${parsed.publicKey}`,
  ].join(', ')

  const envelope =
    JSON.stringify({ event_id: id, sent_at: sentAt }) +
    '\n' +
    JSON.stringify({ type: 'event' }) +
    '\n' +
    JSON.stringify(event) +
    '\n'

  // 3s cap: never let telemetry forwarding block or hang a request path.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': auth,
      },
      body: envelope,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

// Minimal, best-effort stack parse into Sentry frame objects.
function parseStack(stack: string): Array<Record<string, unknown>> {
  return stack
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .map((line) => ({ function: line.slice(3) }))
    .reverse()
}
