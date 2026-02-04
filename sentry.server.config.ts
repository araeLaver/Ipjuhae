import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // 샘플링 비율
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 환경 설정
  environment: process.env.NODE_ENV,
})
