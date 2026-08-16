type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
  timestamp: string
}

function formatError(error: unknown): Record<string, unknown> | undefined {
  if (!error) return undefined
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { raw: String(error) }
}

// Keys whose values are PII/secrets and must never reach the log sink in the
// clear (PIPA). Masking is centralized here so every logger caller is covered.
const SENSITIVE_KEYS = new Set([
  'phone', 'phonenumber', 'email', 'otp', 'code', 'verificationcode',
  'password', 'token', 'accesstoken', 'refreshtoken', 'authorization',
  'ssn', 'residentnumber', 'residentregistrationnumber', 'accountnumber',
])

function maskValue(key: string, value: string): string {
  const k = key.toLowerCase()
  if (k === 'email') {
    const at = value.indexOf('@')
    return at > 0 ? `${value.slice(0, 1)}***${value.slice(at)}` : '***'
  }
  if (k === 'phone' || k === 'phonenumber') {
    return value.length > 4 ? `***${value.slice(-4)}` : '***'
  }
  return '***'
}

function redactPii(meta: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 4) return meta
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = typeof value === 'string' && value.length > 0 ? maskValue(key, value) : '***'
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error)) {
      out[key] = redactPii(value as Record<string, unknown>, depth + 1)
    } else {
      out[key] = value
    }
  }
  return out
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  let processedMeta = meta
  // meta에 error가 있으면 포맷팅
  if (meta?.error) {
    processedMeta = { ...meta, error: formatError(meta.error) }
  }
  if (processedMeta) {
    processedMeta = redactPii(processedMeta)
  }

  const entry: LogEntry = {
    level,
    message,
    meta: processedMeta,
    timestamp: new Date().toISOString(),
  }

  if (process.env.NODE_ENV === 'production') {
    // 프로덕션: 구조화된 JSON 로그 (Sentry/Datadog 등 연동 가능)
    console[level](JSON.stringify(entry))
  } else {
    // 개발: 가독성 좋은 포맷
    const prefix = `[${level.toUpperCase()}]`
    console[level](`${prefix} ${message}`, meta || '')
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
}
