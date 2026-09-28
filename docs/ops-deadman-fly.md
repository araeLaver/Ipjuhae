# Fly 독립 워처 핑 감시기

[DOW-1332](/DOW/issues/DOW-1332) 구현 및 [DOW-1267](/DOW/issues/DOW-1267) 운영 연결 검토 자료. 운영 배포·재시작은 CTO 검토 후 별도 승인 절차로 수행한다.

## 실행 구조

`server.js`가 HTTP listen 이후 `build/ops-deadman.cjs`의 타이머를 시작한다. 시작 즉시 한 번, 이후 60초 간격으로 판정한다. GitHub Actions, 호스트 워처의 스케줄러, 외부 cron HTTP 호출에 의존하지 않는다. `npm run build`가 기존 esbuild로 런타임을 번들하고 Dockerfile이 이미지에 복사한다. `next dev`/`next start`만 실행하면 이 타이머는 시작하지 않는다. 로컬 통합 실행도 `node server.js`를 사용한다.

현재 fly.toml은 nrt에 최소 1개 app 머신을 유지한다. 다른 리전/머신 정지 설정에서는 이 전제를 재검토해야 한다. GitHub 및 온호스트 장애와 분리되지만 Fly 앱·이벤트 루프·PostgreSQL·Resend 장애와는 분리되지 않는다. 기존 gist/Actions, `/api/health`, preflight는 그대로 유지한다. 감시기 예외는 HTTP 서버 기동을 실패시키지 않고 오류를 기록한다.

## 전송 계약과 설정

| 항목 | 값 |
| --- | --- |
| URL | `POST https://www.ipjuhae.com/api/ops/heartbeat` |
| 인증 | `Authorization: Bearer <OPS_HEARTBEAT_SECRET>` |
| 본문 | 비움. 클라이언트 제공 시각을 사용하지 않음 |
| 성공 | DB 커밋 후 200, JSON `receivedAt` (서버 DB UTC 시각) |
| 실패 | 인증 없음/오류 401, 비활성·설정 부족·DB 저장 실패 503; 미들웨어 제한 시 429 가능 |
| 호스트 전송 주기 | 60초 (DevOps 전송부 담당) |
| grace / 판정 주기 | 300초 / 60초 (코드 상수) |

`OPS_DEADMAN_ENABLED=true`로 활성화한다. 기본은 비활성이다. `OPS_HEARTBEAT_SECRET`은 기존 CRON/JWT 비밀과 다른 무작위 32자 이상 값을 사용한다. `OPS_ALERT_EMAIL`은 운영 수신 주소이며 기존 `RESEND_API_KEY`, `EMAIL_FROM`(기본 `noreply@ipjuhae.com`), `DATABASE_URL`, `DB_SCHEMA`를 사용한다. 감시기 메일은 기존 `lib/email.ts`의 Resend 전송 함수를 직접 재사용하며 mock/SendGrid로 우회하지 않는다. 비밀값은 Fly secrets와 호스트 비밀 저장소에만 설정한다.

서버 간 요청은 Origin이 없으므로 **정확히 POST `/api/ops/heartbeat`만** CSRF Origin 검사 예외다. 라우트 자체가 별도 Bearer 인증을 항상 요구하며 쿠키/JWT 사용자 인증을 인정하지 않는다. 다른 메서드/경로의 CSRF 규칙은 유지된다.

## 영속 상태와 알림

`db/migration-045-ops-deadman.sql`을 기존 마이그레이션 목록에 등록했다. 활성화 후 최초 판정 또는 핑이 singleton 상태 행을 생성한다. `armed_at`과 마지막 수신 시각을 PostgreSQL에 저장하므로 프로세스 재시작은 grace를 초기화하지 않는다. 최초 핑이 전혀 오지 않아도 armed_at+300초부터 stale로 전환한다.

행 잠금으로 핑과 판정을 직렬화한다. healthy→stale 및 stale→healthy 각각에 이벤트 한 개를 저장한다. 상태 유지 중 반복 경보는 만들지 않는다. 회복은 다음 판정에서 확인한다. 이전 경보 발송이 실패한 동안 회복해도 과거 누락·회복 이벤트는 둘 다 보존하여 순서대로 전달한다. 판정 사이에 발생했다가 끝난 누락은 관측되지 않을 수 있다.

발송 시도 시각·횟수는 전송 전에 커밋한다. 발송 timeout 10초, 재시도는 최소 60초 이후이며 각 이벤트 UUID를 Resend `Idempotency-Key`로 재사용한다. 수신자·발신자·본문도 저장하여 설정 변경과 재시작으로 요청 내용이 변하지 않는다. 성공 후 DB 커밋이 실패해도 동일 키로 재시도한다. 여러 프로세스가 같은 이벤트를 동시에 보내지 않도록 DB 행 잠금과 60초 lease를 사용한다.

Resend 키 보존 기간은 [공식 문서상 24시간](https://resend.com/changelog/idempotency-keys)이다. 무한 재시도로 중복 메일을 만들지 않도록 첫 시도 후 23시간에 `uncertain`으로 전환하고 `delivery_uncertain` 오류를 남긴다. 이는 전달 보장이 아니다. DevOps는 해당 이벤트의 Resend 수락/배달 이력을 확인하여 수동 후속 통지 여부를 결정해야 한다. 로그 경보 수집에도 연결해야 한다. 이메일 수락(`sent_at`)은 실제 받은편지함 도착을 뜻하지 않는다.

## 적용 및 롤백

1. CTO가 코드·테스트·환경변수·운영 반영 범위를 검토한다.
2. 승인된 DB 대상과 기존 migration 현황을 확인하고 migration 045를 적용한다. 제품 DB에 이 보고 과정에서 적용하지 않는다.
3. `npm run build` 산출물이 들어간 이미지를 승인된 배포 절차로 반영한다. 비밀값과 수신자를 설정하고 마지막으로 기능을 활성화한다. 호스트 워처 전송부를 연결한다.
4. `configuration_invalid`, `scheduler_start_failed`, `tick_failed`, `tick_overlap`, `delivery_retry`, `delivery_uncertain`를 운영 로그 수집에 연결한다. 최초 evaluation 로그와 DB 상태 행 생성을 확인한다.
5. 최초 핑 없음, 정상 수신, 제어된 전송 중단, 회복을 DevOps·QA가 실측한다. 승인 없이 운영 워처 중단/메일 폭주 실험을 하지 않는다.

롤백은 `OPS_DEADMAN_ENABLED=false` 후 승인된 재시작/이전 이미지 복귀다. 핑은 503을 반환하여 감시 중으로 오인하지 않게 한다. 두 테이블과 기존 gist/Actions는 보존한다. 재활성화 시 이전 기산점·미전송 이벤트도 복원되므로 오래된 이벤트 전달 가능성을 먼저 확인한다. DB 행 삭제로 알림 상태를 임의 초기화하지 않는다.

## 지연 측정과 완료 조건

정상 스케줄러·DB·알림 경로에서 **명목 판정 지연은 마지막 핑 또는 최초 활성화 기준 300+60=360초(6분) 이내**다. Node 이벤트 루프 지연, 머신 정지, DB 장애, 메일 장애 때문에 엄밀한 운영 상한은 보장하지 않는다. 회복/경보 메일의 실제 수신 지연은 별도 측정해야 한다.

- `ops_deadman_state`: `evaluation_count`, `last_evaluated_at`, `last_evaluation_gap_ms`, `max_evaluation_gap_ms`, `last_received_at`, `last_receive_gap_ms`.
- evaluation 구조화 로그: `evaluatedAt`, `heartbeatAgeMs`, `evaluationGapMs`, `detectionOverdueMs`.
- heartbeat 로그: 수신 시각과 이전 핑부터의 간격. 빈 본문이므로 송신→수신 단방향 네트워크 지연은 알 수 없다. 호스트에서 요청 시작/완료 시각과 HTTP RTT를 기록한다.
- events: `created_at`, `first_attempt_at`, `last_attempt_at`, `attempts`, `sent_at`, `message_id`, `delivery_status`. `delivery_accepted` 로그에는 이벤트→Resend 수락 경과도 기록한다.
- 받은편지함 도착 UTC 시각을 수동 기록하고 마지막 핑→판정→Resend 수락→실제 수신을 분리한다.

DevOps 보고 표에는 관측 시작/종료, 기대 판정 횟수(60초), 실제 횟수 차이, 최대 판정 공백, 마지막 핑부터 stale 판정까지, Resend 수락 및 받은편지함 지연, 회복 지연을 포함한다. 재시작/DB 장애 공백도 제외하지 않는다. 아직 운영 실측 전이다.

## 검증 재현

- `npm run typecheck`
- `npm run build`
- `OPS_TEST_DATABASE_URL=postgresql://127.0.0.1:<임시포트>/postgres npx vitest run __tests__/ops/deadman.test.ts __tests__/middleware.test.ts`

테스트는 지정 DB에 무작위 `deadman_test_*` 스키마만 만들고 삭제한다. 반드시 폐기 가능한 로컬 DB를 사용한다. URL이 없으면 PostgreSQL 통합 케이스는 skip되므로 전체 통과 증거로 사용하지 않는다. 네트워크 메일은 mock이며 운영 수신 실측을 대체하지 않는다.

실제 HTTP/미들웨어·프로세스 재시작·타이머 재현은 빌드 완료 후 다음으로 실행한다. 테스트용 별도 서버(기본 18089)를 띄우며 외부 메일은 보내지 않는다.

```sh
OPS_TEST_DATABASE_URL=postgresql://127.0.0.1:<임시포트>/postgres node scripts/qa/check-ops-deadman-runtime.mjs
```

운영자는 아래 읽기 전용 쿼리로 장기 미발송 및 불확실 이벤트를 확인한다(`search_path`를 운영 스키마로 설정).

```sql
SELECT id, kind, created_at, first_attempt_at, last_attempt_at, attempts, delivery_status
FROM ops_deadman_events
WHERE delivery_status <> 'sent'
ORDER BY created_at;
```

## 2026-09-29 구현 검증 결과

- `npm run typecheck`: 통과.
- 관련 테스트: 임시 PostgreSQL 17을 포함해 17개 통과, skip 없음.
- 전체 테스트: 90개 파일 통과/2개 파일 skip, 926개 테스트 통과/16개 skip. 이 실행은 통합 DB URL을 지정하지 않아 새 DB 통합 8개도 skip에 포함하며, 이 8개는 위 별도 실행에서 모두 통과했다.
- production 빌드: 의존성까지 복사한 격리 디렉터리에서 통과. 공유 작업 폴더의 실행 중인 `next dev`와 `.next` 충돌이 있어 격리하여 확인했다. 기존 Hook/img/Browserslist 및 Stripe 미설정 경고는 남아 있다.
- 운영 DB 마이그레이션, Fly 배포/재시작, 실제 Resend 발송 및 받은편지함 수신은 수행하지 않았다.
- 독립 QA: [DOW-1334](/DOW/issues/DOW-1334). 운영 반영 검토는 CTO, 호스트 전송부 연결 및 운영 실측은 [DOW-1267](/DOW/issues/DOW-1267)의 DevOps 담당이다.
- production HTTP 런타임 smoke: PASS. Origin 없는 무인증/잘못된 Bearer는 401, 정상 핑은 200. 실제 Node 프로세스 종료·재기동 후 `armed_at`과 수신 시각 보존을 확인했다. 재기동 이후 추가 판정 1회의 DB 관측 간격은 **59,490ms**였다(기동 직후 판정 처리 시점과 interval 기준점 차이 포함). 로컬 관측 한 회이며 운영 지연 보장의 근거로 사용하지 않는다. 외부 메일 전송 없음.
