# Rentme MVP Launch Checklist

## Required before launch

- [ ] `DATABASE_URL` points at the production Postgres database.
- [ ] `DB_SCHEMA=ipjuhae` unless the production schema name has intentionally changed.
- [ ] `npm run db:migrate` completed against production.
- [ ] `JWT_SECRET` is a production-only random value of at least 32 bytes.
- [ ] `CRON_SECRET` is a production-only random value and cron callers send `Authorization: Bearer <CRON_SECRET>`.
- [ ] `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_BASE_URL` are the final public HTTPS origin.
- [ ] Docker/Koyeb routes traffic to container port `8000`.
- [ ] `/api/health` returns `200` with `database: "ok"` after deployment.

## Feature configuration

- [ ] Supabase OAuth: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` if Supabase OAuth login is enabled.
- [ ] Social login: set provider credentials for each enabled provider: Kakao, Naver, Google.
- [ ] OpenAI: set `OPENAI_API_KEY` if AI intro generation or semantic matching should be live.
- [ ] AI Omakase: set `AI_OMAKASE_API_KEY` and `AI_OMAKASE_BASE_URL` if the startup-funded AI API stack should be live.
- [ ] SMS: set `SMS_PROVIDER=nhn` or `twilio` plus that provider's credentials. Do not launch real phone verification with `mock`.
- [ ] Email: set `EMAIL_PROVIDER=resend`, `sendgrid`, or SMTP credentials for magic links and reference requests.
- [ ] Storage: set `STORAGE_PROVIDER=s3` plus bucket, endpoint, access key, secret, region, and optional public CDN URL.
- [ ] Verification: set `VERIFICATION_PROVIDER=codef` or `nice` and required provider credentials. Do not present mock verification as real verification.
- [ ] Stripe: set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, and `STRIPE_PRICE_PRO` before enabling paid subscriptions.
- [ ] Rate limiting: set Upstash Redis credentials for multi-instance production.

## Runtime assumptions

- [ ] Start command is `node server.js` through `npm start` or Docker `CMD`.
- [ ] `server.js` can read `.next/required-server-files.json`; this requires `npm run build` or the Docker build stage.
- [ ] Socket.IO is served at `/api/ws`; reverse proxy must allow WebSocket upgrade and polling.
- [ ] SSE endpoint `/api/messages/conversations/[id]/stream` is not buffered by the proxy.
- [ ] Koyeb scaling remains `min: 1`, `max: 1` until Socket.IO fan-out is backed by a shared adapter.
- [ ] Cron endpoint `/api/cron/references` is called on the intended schedule with the cron secret.
- [ ] Upload provider is not `mock` for production document/property/profile image flows.
- [ ] Internal analytics uses the `analytics_events` table; no external analytics provider is currently wired.

## Verification commands

Run these without production secrets where possible:

```bash
npm run launch:check
npm run typecheck
npm run test:run
npm run build
```

After deploy, verify:

- [ ] `GET /api/health`
- [ ] `GET /api/launch/smoke` (토큰이 설정된 경우 `x-launch-smoke-token` 헤더 전달)
- [ ] Login and logout.
- [ ] Phone verification through the selected SMS provider.
- [ ] Magic link or reference email through the selected email provider.
- [ ] Profile/property image upload through S3/R2.
- [ ] Message room realtime path with Socket.IO, then SSE fallback.
- [ ] Subscription checkout and Stripe webhook when paid plans are enabled.

## 즉시 출시 실행 순서

1. `npm run launch:check`로 운영 필수 의존(인증/스토리지/확인) 누락을 차단합니다.
2. `npm run launch:verify` 또는 개별 `typecheck`, `test:run`, `build`를 순차 실행합니다.
3. 배포 후 다음 API를 직접 확인합니다: `/api/health`, `/api/admin/stats`, `/api/auth/phone/send`, `/api/auth/magic-link`(POST->리다이렉트), `/api/listings/upload`.
4. 배포 완료 후 `npm run launch:smoke`를 실행해 런타임 핵심 신호를 자동 확인합니다.
   - `LAUNCH_SMOKE_BASE_URL`는 앱 URL(예: `https://your-app.example.com`)로 설정
   - 보안을 위해 운영 환경에서는 `LAUNCH_SMOKE_TOKEN`을 비밀값으로 설정해 `/api/launch/smoke`를 보호
   - 운영 환경(`NODE_ENV=production`)에서 토큰 미설정 시 자동으로 실패 처리됨
   - 실패 시 `/api/health` 및 핵심 체크 상태를 즉시 점검

### 릴리즈 게이트 스크립트

- `npm run launch:check`: 환경변수 필수값 검증
- `npm run launch:verify`: 타입체크 + 유닛테스트 + 빌드
- `npm run launch:smoke`: 배포 후 헬스/핵심 API 빠른 검증
  - 권장 실행:
    - `LAUNCH_SMOKE_BASE_URL=https://<prod-domain> LAUNCH_SMOKE_TOKEN=<secret> npm run launch:smoke`
