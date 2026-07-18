# 운영·보안 강화 작업 기록 — 2026-07-17

## 작업 기준

- 저장소: `rentme`
- 기준 브랜치: `main`
- 기준 커밋: `36d93ba874930a908452ea0f011d1be16657c4ec`
- 시작 상태: `origin/main`과 동기화, 작업 트리 clean
- 범위: 로컬 코드·테스트·GitHub Actions·운영 문서
- 실행하지 않은 작업: 운영 배포, Fly secret 변경, 운영 DB 접속/마이그레이션, commit, push

## 처리한 보안 발견

### TH-SEC-001 — 사용자 호출 가능한 모의 서류 승인

- Rule ID: `NEXT-AUTH-001`, `NEXT-INPUT-001`
- Severity: Critical
- Location: `app/api/verifications/process/route.ts`
- Evidence: 기존 엔드포인트는 사용자가 전달한 `documentId`를 대상으로 `Math.random() < 0.9` 결과에 따라 문서를 승인하고 `employment_verified`, `income_verified`, `credit_verified`를 `true`로 갱신할 수 있었다.
- Impact: 인증된 사용자가 실제 외부 검증 없이 자신의 신뢰 정보를 승인 상태로 만들 수 있었다.
- Fix: 기본 `410 Gone`, `NODE_ENV=development`이면서 `ALLOW_LEGACY_MOCK_VERIFICATION=true`인 경우에만 개발용 흐름을 허용했다. 운영에서는 환경변수와 무관하게 인증·DB 접근 전에 차단한다.
- Mitigation: 실제 운영 승인은 CODEF/NICE 제공자 경로만 사용하고, 배포 전 provider 설정을 점검한다.
- False positive notes: UI 링크가 없어도 Route Handler는 직접 호출할 수 있으므로 비노출 UI는 보호 경계가 아니다.

### TH-SEC-002 — Socket.IO 대화방 권한 우회

- Rule ID: `NEXT-AUTH-001`, `REACT-AUTH-001`
- Severity: High
- Location: `server.js`, `hooks/use-chat-socket.ts`
- Evidence: 기존 서버는 일반 로그인 JWT만 확인한 뒤 클라이언트가 보낸 임의 `conversationId`로 room join을 허용했다. 브라우저 훅은 HttpOnly `auth_token`을 `document.cookie`에서 읽으려 해 정상 Socket 연결도 불가능했다.
- Impact: 인증 사용자 간 대화방 구독 권한이 분리되지 않았고, 정상 클라이언트는 사실상 SSE fallback에 의존했다.
- Fix: 대화 참여 여부를 DB에서 확인하는 `POST /api/messages/socket-token`을 추가하고, HS256·issuer·audience·token type·UUID·5분 TTL로 제한한 conversation-scoped JWT만 Socket handshake에 허용했다. 서버는 토큰에 지정된 room만 허용하고 만료 시 연결을 종료한다. 클라이언트는 새 토큰을 발급받아 재연결하며 실패 시 SSE로 전환한다.
- Mitigation: 성공 응답은 `no-store`, 운영 token 요청은 canonical same-origin만 허용하고, 4KB 초과 토큰은 검증 전에 거부한다.
- False positive notes: 일반 JWT가 유효해도 socket 전용 audience/type이 없으면 거부된다.

### TH-REL-001 — CI와 무관한 배포 및 오래된 SHA 재배포

- Rule ID: `NEXT-DEPLOY-001`, `REACT-SUPPLY-001`
- Severity: High
- Location: `.github/workflows/fly.yml`
- Evidence: 기존 Fly workflow는 `main` push 즉시 CI와 독립적으로 배포했다.
- Impact: 실패한 변경이 배포되거나, CI 완료 순서가 뒤집힐 때 오래된 커밋이 나중에 배포될 수 있었다.
- Fix: `CI` workflow의 `main` push 성공 후에만 실행하고 검증된 `head_sha`를 checkout한다. 배포 직전 원격 `main` SHA와 다시 비교해 stale SHA는 배포하지 않는다.
- Mitigation: `production` environment, 배포 concurrency, 최소 `contents: read` 권한을 적용했다.
- False positive notes: CI 성공만으로 최신 SHA임을 보장하지 않으므로 배포 직전 비교가 별도로 필요하다.

### TH-DB-001 — 운영 DB migration baseline 불명확

- Rule ID: `NEXT-INJECT-001`, 운영 변경 안전성
- Severity: High
- Location: `db/migrate.ts`, `db/migration-safety.ts`, `.github/workflows/db-migrate.yml`
- Evidence: 기존 수동 workflow는 일부 SQL만 직접 실행했고, 통합 runner는 `_migrations` 기록만 신뢰해 `schema.sql`부터 전체 이력을 적용했다. 기존 운영 DB가 수동 적용 상태이면 중복 DDL 위험이 있었다.
- Impact: 기존 테이블·인덱스와 migration 기록이 어긋난 상태에서 실패하거나 일부 migration만 적용될 수 있었다.
- Fix: `--plan` 읽기 전용 preflight, schema identifier 검증·quoting, baseline 정책, advisory lock을 추가했다. 핵심 테이블이 있는데 `_migrations` 또는 `schema.sql` 기록이 없으면 apply 전에 fail closed한다. workflow는 `main` exact SHA, `MIGRATE`와 `BASELINE_VERIFIED` 이중 확인, plan 후 apply만 허용한다.
- Mitigation: 운영 baseline을 먼저 읽기 전용으로 조사하고 불일치 시 수동 reconciliation 후 실행한다.
- False positive notes: 새 빈 schema는 정상적으로 전체 migration을 적용할 수 있다.

### TH-SUPPLY-001 — 알려진 취약 의존성 및 비결정적 런타임 설치

- Rule ID: `NEXT-SUPPLY-001`, `REACT-SUPPLY-001`
- Severity: High
- Location: `package.json`, `package-lock.json`, `Dockerfile`
- Evidence: 최초 `npm audit`는 16건(High 6, Moderate 8, Low 2)을 보고했고, Docker runner는 lockfile 없이 `socket.io@4`, `jsonwebtoken@9`를 다시 resolve했다.
- Impact: Next.js·Nodemailer·WebSocket·빌드 도구의 알려진 취약점과 이미지 재현성 저하가 있었다.
- Fix: Next.js/ESLint config `15.5.20`, Nodemailer `9.0.3`, PostCSS `8.5.19`로 갱신하고 호환 범위의 전이 의존성을 업데이트했다. Docker는 별도 `npm ci --omit=dev --ignore-scripts` stage의 lockfile 기반 production tree를 사용한다.
- Mitigation: 잔여 3건은 아래 제한사항에 기록하고 상위 패치 릴리스를 계속 추적한다.
- False positive notes: Next.js가 내부 고정한 PostCSS는 직접 PostCSS dependency를 올려도 교체되지 않는다.

### TH-KEY-001 — disclosure 서명키 용도 혼용

- Rule ID: `NEXT-SECRETS-001`
- Severity: Medium
- Location: `lib/trust-engine.ts`, `scripts/prelaunch-check.mjs`, `.github/workflows/fly-secret-sync.yml`
- Evidence: disclosure HMAC 키가 없으면 `JWT_SECRET`으로 fallback했다.
- Impact: 세션 토큰과 disclosure 서명의 키 수명·회전·노출 범위가 결합됐다.
- Fix: 32자 이상 전용 `DISCLOSURE_SIGNING_KEY`만 허용하고 fallback을 제거했다. 예제 env, launch check, Fly secret sync와 deploy secret 존재 gate를 연결했다.
- Mitigation: 향후 signature `key_id`/version을 저장해 무중단 키 회전을 지원한다.
- False positive notes: 전용 키가 아직 운영에 없으면 기능이 의도적으로 fail closed한다.

### TH-COMP-001 — 법률·제품 승인 게이트가 실행 경로를 차단하지 않음

- Rule ID: `NEXT-AUTH-001`, `NEXT-INPUT-001`, fail-closed 운영 정책
- Severity: High
- Location: `lib/compliance-gates.ts`, `lib/trust-engine.ts`, `lib/contract-trust.ts`, `lib/verification.ts`, `lib/idempotency.ts`, `app/api/v1/*`
- Evidence: `trust_compliance_gates`에는 `automated_scoring=blocked`, `external_data_access=pending`가 기본값으로 존재했지만 관리 API/UI 외 소비 코드가 없었다. 따라서 차단 상태에서도 자동 점수 PUBLISHED 결과·자동 추천을 생성하고 외부조회 요청을 큐에 넣거나 CODEF/NICE를 호출할 수 있었다.
- Impact: 법률·차별 영향·동의·기관 이용조건 검토가 끝나지 않은 기능을 관리자 화면의 상태와 무관하게 직접 API 또는 내부 함수로 실행할 수 있었다. 과거 idempotency 성공 응답도 게이트 차단 뒤 재사용될 수 있었다.
- Fix: 6개 키를 타입으로 고정하고 `approved`이면서 승인 근거·승인자·승인시각이 모두 존재할 때만 허용하는 공통 검사를 추가했다. 행·테이블 누락, 알 수 없는 상태, 불완전 승인, DB 오류는 모두 fail closed한다. 점수·추천·B2B mutation·외부요청은 idempotency 캐시보다 먼저 확인하고, 실제 DB 쓰기 트랜잭션에서는 게이트 행을 `FOR SHARE`로 다시 잠금 확인한다. trust-engine 직접 호출, graph 점수, reference risk/edge, backfill, reference cron, CODEF/NICE adapter에도 동일 정책을 적용했다. 차단 중 공개된 reference는 edge 없이 권리 처리를 완료하고, 승인 뒤 maintenance가 동일 위험판정으로 누락 edge를 backfill한다.
- Mitigation: 게이트 차단은 문서 승인·정정·철회·만료·reference 공개를 막지 않는다. 게이트 조회 SQL 자체가 실패해도 SAVEPOINT로 트랜잭션을 복구하고 자동 판정만 defer한다. 외부요청은 전용 목적·본인 주체·source/consent 허용필드·법률/약관 검토·서버 만료 상한을 모두 검사하며, 외부 provider가 작업 유형과 맞지 않을 때 mock으로 조용히 fallback하지 않는다. 관리자 승인 변경은 migration 029의 DB trigger가 관리자 actor와 OLD/NEW 상태를 같은 트랜잭션에 기록하고 audit UPDATE/DELETE/TRUNCATE를 거부한다.
- False positive notes: 공개 문서 추출은 `manual-review-1.0`으로 서버 고정하며, 다른 engine은 `production_ocr` 승인이 필요하다. `paid_pilot`은 계약 리포트 유료화로 현재 실행 경로가 없고 전자서명 경로도 없다. `b2b_api`는 조직 생성·회원 추가·조직 리포트·조직 AI 처리기록 mutation에 적용했으며 개인 리포트·개인 기록과 조회는 허용한다. 기존 임대인 구독을 이 게이트로 포괄 차단하지 않았다.

### TH-COMP-002 — 계약 리포트 읽기 권한의 쓰기 재사용과 Trust Card 멱등성 재생

- Rule ID: `NEXT-AUTH-001`, `NEXT-INPUT-001`, 서버 측 객체·기능 권한 분리
- Severity: High
- Location: `lib/contract-trust.ts`, `app/api/v1/contract-reports/[id]/*`, `app/api/v1/trust-cards/route.ts`
- Evidence: 리포트 소유자·거래 참가자·활성 조직회원에게 제공하던 넓은 조회 조건을 항목 변경, 상태 전이, Trust Card 발급에도 그대로 사용했다. 따라서 읽기만 가능해야 할 참가자나 일반 조직회원도 검증 결과를 변경하거나 `combined` bearer 카드를 발급할 수 있었다. Trust Card POST는 idempotency cache를 먼저 확인해 회원 제거·조직 정지·B2B gate 차단 뒤에도 과거 201 응답의 `share_token`을 재생할 수 있었다.
- Impact: 권한 없는 사용자가 계약 검토 결과와 공개 상태를 바꾸거나 공유 토큰을 발급할 수 있고, 사후 kill-switch가 과거 멱등 응답을 즉시 차단하지 못했다.
- Fix: 조회 정책은 유지하되 mutation 전용 인가를 트랜잭션 내부에 분리했다. 개인 리포트의 항목 변경·상태 전이는 소유자 또는 플랫폼 관리자, 카드 발급은 소유자만 허용한다. 조직 리포트는 활성 멤버십을 다시 잠금 확인하고, 항목 변경은 `owner/admin/reviewer`, 상태 전이와 카드 발급은 `owner/admin` 역할만 허용한다. 조직 리포트 생성자여도 일반 `member`이면 쓰기 권한이 없다. 항목은 `draft/in_review`에서만 변경하고, 일반 상태 API의 `ready→shared`와 `shared→ready`를 금지해 카드 발급·폐기 흐름을 우회하지 못하게 했다. 조직의 확장성 mutation은 같은 트랜잭션에서 `b2b_api`를 재검사하며, `revoked/expired`는 게이트와 조직 상태가 차단돼도 허용하고 발급된 `issued` 카드도 같은 트랜잭션에서 각각 `revoked/expired`로 전환한다.
- Mitigation: Trust Card 요청은 clone한 본문을 검증한 뒤 현재 권한·조직 상태·게이트·리포트 상태·승인 필드를 idempotency cache보다 먼저 preflight한다. 실제 insert 직전에도 `FOR UPDATE`와 gate `FOR SHARE`로 다시 검사하고, compliance 503은 멱등 응답에 저장하지 않는다. 403 권한 거부, 404 비가시 객체, 409 상태 충돌, 503 compliance 차단을 API에서 구분한다.
- False positive notes: 조회 참가자는 계속 리포트를 볼 수 있지만 쓰기 권한은 얻지 않는다. 개인 리포트에는 `b2b_api`를 적용하지 않는다. 조직 lifecycle에 승인 전용 전이 경로가 아직 없어 조직 상태 `pending`은 기존 호환을 위해 mutation 가능 상태로 유지했고, `suspended/closed`만 차단한다.

## 추가 수정

- `listings.landlord_id`를 숫자로 변환하던 UUID 손상 제거 및 타입·fixture 수정
- Fly Cron에 trust outbox(5분), trust maintenance(03:00 KST), reference expiry(03:15 KST) 등록
- Fly action을 변경 가능한 `master` 대신 검증한 commit SHA로 고정
- production CSP에서 `unsafe-eval`과 사용하지 않는 외부 script/font source 제거
- `X-XSS-Protection`을 현대 브라우저 권장값인 `0`으로 변경
- Windows에서 실패하던 `launch:check`의 POSIX식 환경변수 prefix 제거
- sitemap의 `/match`를 `/matches`로, `properties` UUID URL을 `/properties/{id}`로 수정
- 전용 socket token 및 migration 정책 단위 테스트 추가
- Playwright 1.58.2용 Chromium 145 설치 및 실제 브라우저 E2E 실행
- E2E의 분석 이벤트 요청을 BrowserContext fixture에서 204로 격리해 원격 DB 쓰기 차단
- 로컬 E2E 서버는 기본적으로 실패 전용 로컬 DB 주소를 사용하고, Redis 환경변수를 비워 외부 상태 변경 방지
- 외부 `PLAYWRIGHT_BASE_URL` 사용 시 로컬 서버를 중복 실행하지 않고, 로컬 실행에서는 격리 환경이 적용되지 않은 기존 서버를 재사용하지 않음
- 보호 경로 테스트를 정확한 `/login?redirect=...` 검증으로 강화하고, assertion 없이 통과하던 조건부 테스트와 취약한 폼 locator 제거
- compliance gate 단위·API·trust-engine·외부 provider 경계 테스트 추가
- graph/reference 자동판정 defer·승인 후 backfill, B2B 조직 mutation, 외부조회 self-only 동의, compliance 감사 이력 회귀 테스트 추가
- idempotency 예약을 DB 시계 기반 조건부 atomic UPSERT로 변경하고, DB 반환 예약 시각으로 완료 소유권을 검증
- idempotency 저장 키를 actor별 SHA-256 scope로 분리하고, 부작용 전 compliance 503은 캐시하지 않도록 변경
- notification outbox dispatcher가 실제 지원하는 6개 이벤트만 claim하도록 제한했다. `ExternalVerificationRequested`와 향후 전용 worker 이벤트는 처리되지 않은 채 보존하며, 예상 밖 미지원 이벤트가 반환돼도 `published_at`을 기록하지 않는다.
- 계약 리포트 조회와 mutation 인가를 분리하고, Trust Card preflight·트랜잭션 재검사·리포트 폐기 시 카드 상태 연쇄를 추가했다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm run test:run` | 39 files, 403 tests passed |
| `npm run typecheck` | passed |
| `npm run lint` | exit 0, 기존 Hook dependency·`img` 경고만 존재 |
| `npm run build` | Next.js 15.5.20 production build passed, 141 static pages generated |
| `npm run launch:check` | production-shaped test env에서 passed (Windows PowerShell) |
| GitHub workflow YAML parse | passed (`js-yaml`) |
| `git diff --check` | passed |
| custom `server.js` smoke | local port 3103, `/robots.txt` HTTP 200, 프로세스 정리 완료 |
| Chromium E2E | 17 tests passed (Playwright 1.58.2, Chromium 145) |
| `npm audit --omit=dev` | Critical 0, High 0, Moderate 2, Low 1 |

## 남은 제한사항과 후속 조치

### 배포 전 필수

1. GitHub `production` environment에 reviewer/승인 규칙과 필요한 secrets가 설정됐는지 확인한다.
2. 32자 이상 독립 `DISCLOSURE_SIGNING_KEY`를 GitHub secret에 등록하고 `Fly Secret Sync`를 먼저 실행한다.
3. 운영 `ipjuhae._migrations`를 읽기 전용으로 확인한다. baseline이 없거나 수동 적용 이력이 있으면 기록을 reconciliation하기 전 DB workflow를 실행하지 않는다.
4. `migration-028-contract-report-productization.sql`의 실제 운영 적용 여부는 아직 확인하지 않았다. 이어지는 `migration-029-compliance-gate-audit.sql`을 코드보다 먼저 적용해야 관리자 trust-product 조회·상태 변경이 정상 동작한다.
5. `automated_scoring`·`production_ocr`·`b2b_api`는 승인 근거·승인자·승인시각이 모두 갖춰진 `approved` 상태 전까지 의도적으로 503/fail closed한다. 코드 배포만으로 게이트 상태를 승인하지 않는다.
6. `external_data_access`는 현재 승인하면 안 된다. `ExternalVerificationRequested`는 범용 notification dispatcher가 소비하지 않고 pending 상태로 보존하지만, 전용 `external_verification` consent migration/API, source `terms_reviewed_at` 관리 경로, 실제 outbound worker와 호출 직전 gate/source/consent 재검사가 아직 없다.

### 검증 제한

- 현재 E2E 17개는 공개 페이지, 인증 폼의 로컬 유효성 검사, 미인증 보호 경로 리다이렉트를 검증한다. 격리 DB를 사용하는 실제 회원가입·로그인·인증 사용자 온보딩 시나리오는 아직 없다.
- Docker daemon이 실행 중이지 않아 최종 Docker image build 자체는 검증하지 못했다. Next standalone build와 custom server smoke는 통과했다.
- 운영 DB, Fly, 외부 provider에는 이번 작업에서 접속하거나 변경하지 않았다.

### 잔여 기술 부채

- `npm audit` 잔여: Next.js 내부 PostCSS 8.4.31 관련 Moderate 2건, esbuild 0.27.4 관련 Low 1건. 현재 Next 15 호환 범위에서 강제 downgrade/major upgrade 없이 제거할 수 없어 추적 대상으로 남겼다.
- `instrumentation.ts`의 Sentry 연동은 noop이므로 문서의 “완료” 표현과 실제 상태가 다르다.
- `trust_compliance_gates`의 상태 변경은 append-only DB 감사 이력을 남긴다. 다만 구 `lib/trust-score.ts`의 읽기 시점 계산·노출은 신 trust-engine과 아직 통합되지 않아 별도 kill-switch 정책 결정이 필요하다.
- 외부 provider용 목적별 동의 모델은 아직 없다. 현재 `data_consents`와 `consent_events`는 프로필 조회 목적만 허용하고 source 관리 API도 약관 검토시각을 입력하지 못하며 outbound worker가 없다. 범용 dispatcher의 이벤트 유실은 차단했지만, 전용 consent/role/TTL 모델과 실제 호출 직전 재검사를 함께 구현해야 한다.
- notification outbox의 5분 lease에는 claim owner/token이 없고 알림·delivery receipt·`published_at` 기록도 단일 트랜잭션이나 멱등 제약으로 묶이지 않았다. 처리가 5분을 넘거나 일부 수신자 처리 뒤 실패하면 중복 알림과 늦은 worker의 상태 덮어쓰기가 가능하므로 lease token 기반 조건부 finalize와 receipt idempotency가 필요하다.
- 계약 리포트 mutation 역할 분리, `suspended/closed` 차단, 리포트 폐기 시 카드 상태 연쇄는 완료했다. 다만 조직 lifecycle에 `pending→active` 승인 경로가 없어 `pending`을 호환 상태로 허용한다. Trust Card의 subject/report 일치 검증, 민감도별 필드 공개 정책, 서버 TTL 상한, 다른 조직 관리자가 발급자 소유 카드를 조회·폐기하는 경로, UI의 `can_transition`/`can_issue_card` capability 표시는 후속 작업이다. AI run의 consent/extraction 연결도 아직 검증하지 않는다.
- idempotency 저장 키는 actor-scoped hash를 사용하고 비로그인 요청은 URL 경로까지 scope에 포함한다. 배포 전 raw-key 캐시는 동일 actor와 정확히 같은 request hash인 경우에만 TTL 동안 dual-read하며, actor/hash가 다르거나 안전하게 귀속할 수 없는 행은 재사용하지 않고 만료시킨다.
- `listings`/`properties`, `profiles`/`tenant_profiles`, 구 trust-score/신 trust-engine 모델이 중복된다. 특히 legacy listing detail은 mock 중심이라 canonical `properties`로 통합이 필요하다.
- CSP의 `unsafe-inline`, 광범위한 HTTPS image 허용은 nonce 기반 CSP와 명시적 R2/CDN allowlist로 후속 강화해야 한다.
- 다수 React Hook dependency 및 `<img>` lint 경고가 남아 있다.
- 메타데이터의 서비스명 `임주해`/`입주해` 혼용과 `/og-image.png` 참조를 정리해야 한다.
- TODO의 commit/branch 수치와 Sentry·migration 완료 표시는 현재 상태와 어긋나므로 이 기록을 기준으로 갱신해야 한다.
- `feature/community-trust-docs-kakao`는 main과 크게 분기되고 migration 번호 충돌 가능성이 있어 wholesale merge 대신 선택적 반영이 필요하다.

## 권장 반영 순서

1. 변경 diff 리뷰 및 commit/PR 생성
2. production environment와 secret 준비
3. CI 통과 후 Fly 자동 배포
4. 운영 DB baseline 확인 및 수동 migration workflow 실행
5. launch smoke와 격리 DB 기반 인증 E2E 재검증
