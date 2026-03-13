import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,

  // 세션 리플레이 (선택적)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // 환경 설정
  environment: process.env.NODE_ENV,
});
