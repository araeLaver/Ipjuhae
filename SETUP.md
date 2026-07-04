# 렌트미 MVP 설정 가이드

이 저장소의 프로덕션 경로는 Next.js standalone 빌드와 커스텀 `server.js`입니다. `server.js`가 HTTP 서버, Socket.IO, Next request handler를 함께 띄우므로 Vercel serverless 배포를 기본 경로로 보지 않습니다.

## 1. 로컬 개발

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

로컬 앱 URL은 기본 `http://localhost:3000`입니다. Docker Compose를 쓰는 경우 호스트 `3000` 포트가 컨테이너 내부 `8000` 포트로 연결됩니다.

```bash
docker compose up -d
```

## 2. 필수 환경 변수

프로덕션 런타임에서 반드시 설정합니다.

```env
PORT=8000
HOSTNAME=0.0.0.0
NEXT_PUBLIC_APP_URL=https://www.ipjuhae.com
NEXT_PUBLIC_BASE_URL=https://www.ipjuhae.com
DATABASE_URL=postgresql://user:password@host:5432/dbname
DB_SCHEMA=ipjuhae
JWT_SECRET=replace-with-openssl-rand-base64-32
CRON_SECRET=replace-with-openssl-rand-base64-32
```

`NODE_ENV`는 `.env.local`에 넣지 않습니다. Docker/Koyeb 같은 런타임 환경에서 `production`으로 설정하고, 로컬 `next dev`와 `next build`는 Next.js가 직접 설정하게 둡니다.

`NEXT_PUBLIC_APP_URL`과 `NEXT_PUBLIC_BASE_URL`은 OAuth redirect, 이메일/알림 링크, Socket.IO CORS, 일부 서버 컴포넌트 fetch 기준 URL에 쓰입니다. 둘 다 실제 공개 도메인으로 맞춥니다.

## 3. 기능별 환경 변수

MVP 기능을 실제 서비스로 운영하려면 아래 provider 값을 mock이 아닌 값으로 바꿉니다. mock 기본값은 데모와 개발 편의용입니다.

| 영역 | 변수 | 비고 |
| --- | --- | --- |
| Supabase OAuth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts`가 OAuth 클라이언트 생성 시 요구합니다. |
| OpenAI | `OPENAI_API_KEY` | AI 매칭/자기소개 생성. 없으면 OpenAI 기반 보너스는 건너뜁니다. |
| AI Omakase | `AI_OMAKASE_API_KEY`, `AI_OMAKASE_BASE_URL` | 자기소개 생성, 법률 검토 초안, Image-to-Text OCR에 사용합니다. 서비스 URL은 환경변수로만 설정합니다. |
| SMS | `SMS_PROVIDER`, `NHN_SMS_APP_KEY`, `NHN_SMS_SECRET_KEY`, `NHN_SMS_SENDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | `SMS_PROVIDER=mock`은 프로덕션 전화 인증에 부적합합니다. |
| Email | `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | magic link와 reference 이메일 발송 경로입니다. |
| Storage | `STORAGE_PROVIDER`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_PUBLIC_URL` | `STORAGE_PROVIDER=s3`일 때 업로드에 필요합니다. `AWS_*` alias도 일부 레거시 업로드 경로에서 지원됩니다. |
| Verification | `VERIFICATION_PROVIDER`, `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_PUBLIC_KEY`, `CODEF_API_BASE`, `NICE_CLIENT_ID`, `NICE_CLIENT_SECRET` | `mock`은 실제 재직/소득/신용/본인 인증이 아닙니다. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO` | 미설정 시 구독 기능은 데모/503 경로로 제한됩니다. |
| Rate limit | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | 미설정 시 인메모리 fallback이라 다중 인스턴스에 부적합합니다. |

분석/로깅은 현재 DB 기반 `analytics_events`와 서버 로그가 기본입니다. 별도 외부 analytics provider는 배선되어 있지 않습니다.

## 4. 데이터베이스

`npm run db:migrate`가 지원되는 배포 경로입니다. 실행 순서는 [db/MIGRATION_PATH.md](db/MIGRATION_PATH.md)에 정리되어 있습니다.

```bash
DATABASE_URL=postgresql://... DB_SCHEMA=ipjuhae npm run db:migrate
```

Supabase SQL Editor에 오래된 `supabase/schema.sql`을 붙여넣는 방식은 이 저장소의 현재 마이그레이션 경로와 맞지 않습니다.

## 5. Koyeb/Docker 배포

이 저장소의 `Dockerfile`은 runner stage에서 `PORT=8000`을 노출하고 `node server.js`를 실행합니다. `koyeb.yaml`도 `8000` 포트와 `/api/health` 헬스체크를 기준으로 합니다.

배포 전에 Koyeb Secret 또는 환경 변수로 최소 다음 값을 설정합니다.

- `DATABASE_URL`
- `JWT_SECRET`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_BASE_URL`
- 실제 provider를 켤 경우 기능별 secret

빌드 시 `NEXT_PUBLIC_*` 값은 Next.js에 인라인될 수 있으므로, 공개 도메인이 바뀌면 새 이미지를 빌드합니다.

## 6. 인증/OAuth 설정

소셜 로그인 provider에는 실제 도메인을 등록합니다.

- 앱 도메인: `https://www.ipjuhae.com`
- Supabase callback: `https://[your-project].supabase.co/auth/v1/callback`
- 자체 OAuth callback: `https://www.ipjuhae.com/api/auth/social/[provider]/callback`

provider별 콘솔에서 Kakao, Naver, Google client id/secret을 발급하고 `.env.local` 또는 배포 Secret에 넣습니다.

## 7. 출시 전 확인

상세 체크리스트는 [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)를 사용합니다. 최소 검증 명령:

```bash
npm run typecheck
npm run test:run
npm run build
```

프로덕션 secret이 없는 환경에서는 provider 연동 테스트 대신 mock fallback 여부와 503/데모 응답이 명확한지 확인합니다.
