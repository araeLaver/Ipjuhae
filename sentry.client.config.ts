import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 샘플링 비율 (프로덕션에서 조절)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 개발 환경에서는 콘솔에만 출력
  debug: false,

  // 세션 리플레이 (선택적)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // 환경 설정
  environment: process.env.NODE_ENV,
})
