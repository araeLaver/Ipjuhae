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

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
  }

  // meta에 error가 있으면 포맷팅
  if (meta?.error) {
    entry.meta = { ...meta, error: formatError(meta.error) }
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
