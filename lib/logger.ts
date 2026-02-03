type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  error?: unknown
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

function log(level: LogLevel, message: string, context?: string, error?: unknown) {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  }

  const errorDetails = formatError(error)

  if (process.env.NODE_ENV === 'production') {
    // 프로덕션: 구조화된 JSON 로그 (Sentry/Datadog 등 연동 가능)
    console[level](JSON.stringify({ ...entry, error: errorDetails }))
  } else {
    // 개발: 가독성 좋은 포맷
    const prefix = `[${level.toUpperCase()}] ${context ? `[${context}] ` : ''}`
    console[level](`${prefix}${message}`)
    if (errorDetails) console[level](errorDetails)
  }
}

export const logger = {
  info: (message: string, context?: string) => log('info', message, context),
  warn: (message: string, context?: string, error?: unknown) => log('warn', message, context, error),
  error: (message: string, context?: string, error?: unknown) => log('error', message, context, error),
}
