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

### CTO 기술 승인안

2026-08-28 KST 기준 production rehearsal의 기본 공급자 조합은 아래 기준으로 승인합니다. 단, 비용·계약·개인정보 처리 조건과 실제 credential 발급은 보드 승인 후 진행합니다.

| 구분 | 기본 승인안 | 승인 조건 |
| --- | --- | --- |
| SMS | `SMS_PROVIDER=nhn` 우선, 이미 Twilio 운영 계약이 있으면 `twilio` 허용 | 국내 발신번호 등록, 실발송 테스트 번호 1개, 실패/과금 모니터링 가능 |
| Email | `EMAIL_PROVIDER=resend` 우선, 기존 SendGrid 운영 계정이 있으면 `sendgrid` 허용 | 발신 도메인 인증, bounce/spam 이벤트 확인, magic link 도달 테스트 가능 |
| Storage | `STORAGE_PROVIDER=s3` | 운영 전용 bucket, 앱 전용 access key, 공개 URL/CDN 정책 확정, 서버측 암호화 사용 |
| Verification | `VERIFICATION_PROVIDER=nice` 우선, CODEF 계약·심사 범위가 이미 확정되면 `codef` 허용 | 운영 계약, 사용자 고지/동의 문구, 외부 조회 목적과 보존 정책 확인 |

이 승인안은 기술적으로 허용 가능한 기본 조합을 고정하기 위한 것입니다. 실제 운영값 주입 전에는 보드가 공급자 계약·비용·개인정보 처리 조건을 확인해야 합니다.

### 승인 및 주입 절차

1. 보드가 SMS, email, storage, verification 공급자와 운영 계약 범위를 승인합니다.
2. DevOps가 승인된 값을 GitHub `production` environment와 배포 runtime secret에 등록합니다. `.env.local`이나 이슈 댓글에는 운영값을 저장하지 않습니다.
3. `DATABASE_URL`이 실제 runtime DB를 가리키는지 확인하고 `npm run db:migrate`를 승인된 절차로 실행합니다.
4. runtime에서 아래 명령을 실행하되 secret 값은 출력하지 않고 성공/실패와 누락된 변수 이름만 기록합니다.

```bash
npm run launch:check
```

5. `launch:check` 통과 후에만 `npm run launch:verify`, 배포, `npm run launch:smoke` 순서로 진행합니다.

### 로컬 dry-run 프로파일

일일 품질 점검처럼 운영 secret이 없는 환경에서는 아래 명령으로 `launch:check` 검증 로직만 확인합니다.

```bash
npm run launch:check:dry-run
```

- `.env.launch-check.example`은 non-secret placeholder만 담은 추적 파일입니다.
- dry-run은 외부 DB, S3, SMS, email, NICE/CODEF credential의 실제 존재나 계약 상태를 증명하지 않습니다.
- production rehearsal에서는 반드시 실제 runtime secret 주입 후 `npm run launch:check`를 실행합니다.
- 기본 `npm run launch:check`는 `placeholder`, `not-a-real`, `replace-with`, `example.invalid`, `localhost` 같은 placeholder 흔적을 production 값으로 인정하지 않습니다.

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
npm run launch:check:dry-run
npm run typecheck
npm run test:run
npm run build
```

`npm run launch:check`는 production secret 주입이 끝난 runtime 또는 GitHub `production` environment에서만 실행합니다.

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
   - 종료 코드는 `/api/launch/smoke` 응답의 개별 check 단위로 판정합니다. `LAUNCH_SMOKE_EXPECTED_FAILURES`(쉼표 구분)에 올린 항목이 `ok: false`여도 known gap으로 로그만 남기고 exit 0, 목록 밖 항목이 깨지면 이름을 찍고 exit 1입니다. 기본값은 조달 미완인 `sms,verification`(DOW-912)이고, 목록의 항목이 통과로 바뀌면 "허용 목록에서 빼 주세요" 안내가 출력됩니다. 근거: DOW-1131.
   - **필수 항목은 허용 목록으로 가릴 수 없습니다.** `database`, `jwt_secret`, `email`, `storage`, `runtime_env`는 `LAUNCH_SMOKE_EXPECTED_FAILURES`에 넣어도 무시되며(넣으면 경고 출력), 깨지면 항상 exit 1입니다. 또한 이 항목이 응답 `checks`에 **아예 없으면** API가 항목을 드롭한 것으로 보고 회귀 처리합니다 — `ok: false`만 세면 항목이 사라졌을 때 조용히 통과하기 때문입니다. 근거: DOW-1131.

## 앱(모바일) 실기기 수동 확인

자동 검증은 Expo/React Native 네이티브 모듈을 셔임으로 대체하므로, **실제 OS 권한 변경**은 태우지 못합니다.
아래 항목은 스토어 제출 전 실기기(또는 시뮬레이터)에서 사람이 한 번 확인합니다. 근거: DOW-1114, DOW-1117.

- [ ] 앱에서 알림을 켜고 권한을 허용한 뒤, 기기 설정에서 알림 권한을 끄고 **앱을 재시작**한다 → 알림 설정 화면의 Switch가 OFF, 안내 문구는 "기기 설정에서 알림 권한이 꺼져 있습니다."
- [ ] 같은 상황에서 **앱을 재시작하지 않고** 기기 설정에서 앱으로 복귀한다 → 잠깐 로딩 표시 후 Switch가 OFF로 바뀐다(켜진 채로 남으면 회귀).
- [ ] 권한을 다시 허용하고 복귀하면 Switch는 OFF로 유지되고, 사용자가 직접 켜야 알림이 다시 등록된다(선호값은 권한이 꺼질 때 함께 꺼지는 설계).
- [ ] 알림을 켠 상태에서 비행기 모드로 앱을 복귀시킨다 → 등록해 둔 토큰이 있으면 실패 안내가 **뜨지 않고**, 앱의 다른 기능도 그대로 쓸 수 있다(복귀마다 안내가 뜨면 회귀. 근거: DOW-1117).
- [ ] 위 1번 상황 직후 DB에서 `SELECT * FROM push_tokens WHERE token = '<그 기기 토큰>'` → **행이 없어야 한다**. 권한을 밖에서 꺼도 서버가 이 기기를 발송 대상으로 들고 있으면 회귀입니다(DOW-1117).
- [ ] 알림을 켜 둔 채 앱을 여러 번 전환했다 돌아온다 → `push_tokens.updated_at`이 복귀마다 갱신되지 않는다(같은 토큰이면 재등록하지 않는 설계).
- [ ] 계정 A로 알림을 켠 뒤 **로그아웃 없이 세션을 만료**시키고 계정 B로 로그인한다 → `push_tokens`에서 해당 token의 `user_id`가 **B**를 가리킨다. A로 남아 있으면 회귀입니다. 베타 테스터가 한 기기에서 임차인/임대인 계정을 번갈아 쓰는 시나리오입니다(DOW-1117 후속).

자동 검증 범위(실기기 없이 CI에서 도는 부분):

```bash
npx vitest run __tests__/mobile/notification-permission-sync.test.ts   # service 계층 권한 동기화
npx vitest run __tests__/mobile/notification-foreground-resync.test.ts # 포그라운드 복귀 재조회
```

### 릴리즈 게이트 스크립트

- `npm run launch:check`: 환경변수 필수값 검증
- `npm run launch:verify`: 타입체크 + 유닛테스트 + 빌드
- `npm run launch:smoke`: 배포 후 헬스/핵심 API 빠른 검증
  - 권장 실행:
    - `LAUNCH_SMOKE_BASE_URL=https://<prod-domain> LAUNCH_SMOKE_TOKEN=<secret> npm run launch:smoke`
