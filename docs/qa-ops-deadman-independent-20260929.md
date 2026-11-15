# Fly 독립 핑 감시기 QA 결과

대상: [DOW-1334](/DOW/issues/DOW-1334), 구현 [DOW-1332](/DOW/issues/DOW-1332), 운영 연결 [DOW-1267](/DOW/issues/DOW-1267).
검증 기준: `0730fd3bae967b364e903710cd99866ec0723e0b` 작업 트리, 2026-09-29 KST. 제품 코드 변경 없음.

## 자동화 및 재현

폐기 가능한 PostgreSQL 17을 `127.0.0.1:18439`에 새로 생성했다. 운영 DB와 비밀값을 사용하지 않았다.

```sh
OPS_TEST_DATABASE_URL=postgresql://127.0.0.1:18439/postgres npx vitest run __tests__/ops/deadman.test.ts __tests__/middleware.test.ts
OPS_TEST_DATABASE_URL=postgresql://127.0.0.1:18439/postgres npx vitest run
```

- 관련 테스트: 19 PASS, 0 SKIP. 인증 없음/오류 401 및 DB 무변경, 정확한 POST 경로의 CSRF 예외, 최초 핑 없음, 중복 판정, 회복·재누락, DB 연결 재생성, 발송 실패 재시도, 키·본문 보존, DB 장애 503을 확인했다.
- 회귀 테스트 2개 추가: 미전송 stale 이후 recovered 순서 및 60초 lease, Resend 수락 후 DB 기록 실패를 CHECK constraint로 주입한 뒤 동일 키·본문 재시도.
- 기존 uncertain 테스트 시각을 24시간에서 23시간 1초로 좁혀 명시된 제한 직후 자동 발송 중지를 확인했다.
- 전체 회귀: 90개 파일 PASS/2개 SKIP, 936개 테스트 PASS/8개 SKIP. 별도 DB 설정이 필요한 기존 trust/community 테스트는 미검증이며 deadman 통합 테스트는 모두 실행했다. 전체 회귀 후 uncertain 시각만 조정하고 관련 19개를 재실행해 통과했다.
- production 빌드: `.env*`, `.next`, `.git`를 제외한 별도 복사본과 독립 node_modules에서 `npm run build` 성공(exit 0), 타입 검사 포함. 기존 Hook/img/Browserslist 및 Stripe 미설정 경고 확인.
- 격리 복사본의 첫 전체 회귀는 `.git`가 없어 `home-redirect`의 `git grep` 검사 1개가 실패했다. Git 메타데이터가 있는 원본에서 재실행해 전체 통과했으므로 테스트 환경 원인으로 분류했다.

## HTTP 런타임 재현과 QA 스크립트 수정

격리 production 산출물에서 다음 명령으로 실행했다.

```sh
OPS_TEST_DATABASE_URL=postgresql://127.0.0.1:18439/postgres OPS_TEST_HTTP_PORT=18440 node scripts/qa/check-ops-deadman-runtime.mjs
```

기존 스크립트는 재시작 첫 판정 간격의 59초 하한에서 실패했다. 진단 출력 추가 후 **58,960ms**로 재현했다. `startDeadmanScheduler`는 `setInterval` 설정 직후 비동기 즉시 판정을 시작하므로 DB 초기화 소요 시간이 첫 DB 판정 간격에서 빠진다. 따라서 이 측정값만으로 정상 타이머 주기를 판정하는 것은 부정확하다.

QA 수정: 첫 간격은 양수 및 65초 미만인지 확인하고, 추가 정기 판정까지 기다려 정기 판정 사이 간격에 기존 59~65초 assertion을 적용한다. 첫 간격과 정기 간격을 따로 출력하며 실패 시 실측값을 표시한다. 제품 타이머는 수정하지 않았다.

최종 HTTP smoke는 PASS(exit 0). 무인증/오류 Bearer 401, 정상 핑 200, 실제 Node 종료·재기동 후 `armed_at`과 `last_received_at` 보존을 확인했다. 첫 간격 **59,311ms**, 정기 간격 **59,997ms**를 관측했고 외부 메일 발송은 없었다. 로컬 한 회 관측이므로 운영 지연 보장으로 사용하지 않는다.

## 위험도와 운영 인계

검증 범위에서 배포를 차단할 제품 결함은 발견하지 못했다. 운영 검증은 아직 필요하다.

- 중간 위험: 최초 pending 이벤트를 우선 처리하므로 stale 발송 장애 중 recovered도 대기한다. 실패→회복→재시도로 재현했고 순서 보존은 정상이다. 메일 장애 시 회복 알림 지연도 운영 지표에 포함해야 한다.
- 중간 위험: 첫 시도 후 23시간 이후 uncertain 이벤트는 자동 발송하지 않는다. DevOps가 `delivery_uncertain` 로그와 DB 미발송 목록을 수집하고 전달 이력 확인·수동 통지를 맡아야 한다.
- 명목 6분은 정상 타이머·DB 조건의 판정 목표다. Fly/DB/Resend 장애 및 받은편지함 수신 시간을 보장하지 않는다.
- CTO 검토 및 운영 연결 후 DevOps·QA가 마지막 핑→stale 판정→Resend 수락→실제 수신과 회복 지연을 측정해야 한다. 이번 QA에서는 운영 migration, 배포, 운영 프로세스 재시작, 실제 메일 발송을 실행하지 않았다.
