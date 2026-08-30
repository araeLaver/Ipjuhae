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

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_PATTERN = /\b(?:\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g
const SECRET_ASSIGNMENT_PATTERN = /\b(password|token|access[_-]?token|refresh[_-]?token|authorization|otp|verification[_-]?code|code)\s*[:=]\s*([^\s,;&"'`)\]}]+)/gi
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi

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

function redactText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, (match) => maskValue('email', match))
    .replace(PHONE_PATTERN, (match) => maskValue('phone', match.replace(/\D/g, '')))
    .replace(BEARER_PATTERN, 'Bearer ***')
    .replace(SECRET_ASSIGNMENT_PATTERN, (_match, key) => `${key}=***`)
}

function redactValue(key: string, value: unknown, depth: number): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return typeof value === 'string' && value.length > 0 ? maskValue(key, redactText(value)) : '***'
  }
  if (value instanceof Error) {
    return redactPii(formatError(value) ?? {}, depth + 1)
  }
  if (typeof value === 'string') {
    return redactText(value)
  }
  if (Array.isArray(value)) {
    return depth > 4 ? value : value.map((item) => redactValue(key, item, depth + 1))
  }
  if (value && typeof value === 'object') {
    return depth > 4 ? value : redactPii(value as Record<string, unknown>, depth + 1)
  }
  return value
}

function redactPii(meta: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 4) return meta
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    out[key] = redactValue(key, value, depth)
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
  const processedMessage = redactText(message)

  const entry: LogEntry = {
    level,
    message: processedMessage,
    meta: processedMeta,
    timestamp: new Date().toISOString(),
  }

  if (process.env.NODE_ENV === 'production') {
    // 프로덕션: 구조화된 JSON 로그 (Sentry/Datadog 등 연동 가능)
    console[level](JSON.stringify(entry))
  } else {
    // 개발: 가독성 좋은 포맷
    const prefix = `[${level.toUpperCase()}]`
    console[level](`${prefix} ${processedMessage}`, processedMeta || '')
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
}
