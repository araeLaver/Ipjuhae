# Rentme MVP Launch Checklist

> 운영값을 로컬 파일, 터미널 출력, 이슈 댓글에 복사하지 않습니다. 보드 승인 후 GitHub `production` environment와 실제 배포 runtime에 직접 등록하고, 아래 검증에서는 값이 아닌 존재 여부와 검사 결과만 기록합니다.

## 운영 환경변수 승인 게이트

아래 표의 모든 행이 승인되어야 production launch rehearsal을 시작할 수 있습니다. 승인자는 공급자 선택과 비용·약관을 확인하고, DevOps는 secret 저장 위치와 runtime 반영 여부를 확인합니다.

| 구분 | 필수 설정 | 승인 기준 | 담당 승인 |
| --- | --- | --- | --- |
| Database | `DATABASE_URL`, `DB_SCHEMA=ipjuhae` | 운영 전용 DB, TLS/접근제어, migration 대상 schema 확인 | 보드 + DevOps |
| 인증 | `JWT_SECRET` | 운영 전용 무작위 값, 최소 32자, 다른 secret과 재사용 금지 | 보드 + DevOps |
| 신뢰 공개 | `DISCLOSURE_SIGNING_KEY` | 운영 전용 무작위 값, 최소 32자, `JWT_SECRET`과 분리 | 보드 + DevOps |
| Cron | `CRON_SECRET` | 운영 전용 무작위 값, GitHub Actions 호출값과 runtime 값 일치 | 보드 + DevOps |
| 공개 URL | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL` | 동일한 최종 public HTTPS origin, preview/localhost 금지 | 보드 + DevOps |
| SMS | `SMS_PROVIDER=nhn` + `NHN_SMS_APP_KEY`, `NHN_SMS_SECRET_KEY`, `NHN_SMS_SENDER`; 또는 `SMS_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | 실발송 계정, 발신번호 등록, 비용·개인정보 처리 조건 확인 | 보드 |
| Email | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`; `sendgrid` + `SENDGRID_API_KEY`; 또는 `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | 운영 발신 도메인/주소 인증, 반송 처리 및 비용 확인 | 보드 |
| Storage | `STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | 운영 bucket, 최소 권한, 암호화·보존 정책 확인. R2 사용 시 `S3_ENDPOINT`, 공개 제공 시 `S3_PUBLIC_URL`도 확인 | 보드 + DevOps |
| Verification | `VERIFICATION_PROVIDER=codef` + `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_PUBLIC_KEY`; 또는 `nice` + `NICE_CLIENT_ID`, `NICE_CLIENT_SECRET` | 운영 계약·자격증명, 사용자 고지와 개인정보 처리 조건 확인 | 보드 |

### 승인 및 주입 절차

1. 보드가 SMS, email, storage, verification 공급자와 운영 계약 범위를 승인합니다.
2. DevOps가 승인된 값을 GitHub `production` environment와 배포 runtime secret에 등록합니다. `.env.local`이나 이슈 댓글에는 운영값을 저장하지 않습니다.
3. `DATABASE_URL`이 실제 runtime DB를 가리키는지 확인하고 `npm run db:migrate`를 승인된 절차로 실행합니다.
4. runtime에서 아래 명령을 실행하되 secret 값은 출력하지 않고 성공/실패와 누락된 변수 이름만 기록합니다.

```bash
npm run launch:check
```

5. `launch:check` 통과 후에만 `npm run launch:verify`, 배포, `npm run launch:smoke` 순서로 진행합니다.

### 결과 기록 템플릿

```md
- 실행 환경: production runtime / GitHub `production` environment
- 실행 시각: YYYY-MM-DD HH:mm KST
- 공급자 선택: SMS=<provider>, Email=<provider>, Storage=<provider>, Verification=<provider>
- `npm run launch:check`: PASS 또는 FAIL
- 누락 항목: 없음 또는 환경변수 이름만 기록
- 검증자: <담당자>
```

## Required before launch

- [ ] `DATABASE_URL` points at the production Postgres database.
- [ ] `DB_SCHEMA=ipjuhae` unless the production schema name has intentionally changed.
- [ ] `npm run db:migrate` completed against production.
- [ ] `JWT_SECRET` is a production-only random value of at least 32 bytes.
- [ ] `DISCLOSURE_SIGNING_KEY` is a separate production-only random value of at least 32 bytes and is not reused as `JWT_SECRET`.
- [ ] `CRON_SECRET` is a production-only random value and cron callers send `Authorization: Bearer <CRON_SECRET>`.
- [ ] `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_BASE_URL` are the final public HTTPS origin.
- [ ] Docker/Koyeb routes traffic to container port `8000`.
- [ ] `/api/health` returns `200` with `database: "ok"` after deployment.

## Feature configuration

- [ ] Supabase OAuth: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` if Supabase OAuth login is enabled.
- [ ] Social login: set provider credentials for each enabled provider: Kakao, Naver, Google.
- [ ] OpenAI: set `OPENAI_API_KEY` if AI intro generation or semantic matching should be live.
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
