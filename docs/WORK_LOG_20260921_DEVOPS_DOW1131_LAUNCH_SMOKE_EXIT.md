# 2026-09-21 DevOps — DOW-1131 launch-smoke 종료 코드 판정 교체

## 배경

DOW-362(7월 readiness QA smoke)에서 QA가 `scripts/launch-smoke.mjs`의 결함을 보고했다. 개별 HTTP 검사 5/5가 통과해도 `/api/launch/smoke`가 `503`이면 무조건 `exit 1`이라, 조달 미완으로 예상된 `sms`/`verification` 실패(DOW-912 추적)와 `database`/`jwt_secret` 같은 신규 회귀가 자동화 입장에서 동일한 신호였다. 같은 파일의 체크 정의는 `[200, 503]`과 `['ok', 'degraded']`를 정상으로 받고 있어 스크립트 내부에서 판정 기준이 어긋나 있었다.

`launch-smoke.mjs`는 DevOps가 배포 검증에 쓰는 도구라, 엔지니어에게 배정된 상태를 기다리지 않고 DevOps가 직접 처리했다.

## 변경

- `scripts/launch-smoke.mjs`
  - `runCheck`가 파싱한 응답 본문을 `payload`로 함께 반환.
  - `reportSmokePayload()` 추가. `/api/launch/smoke` 본문의 `checks`를 항목 단위로 읽어 허용 목록 밖 항목이 `ok: false`일 때만 회귀로 판정한다.
  - `parseExpectedFailures()` 추가. `LAUNCH_SMOKE_EXPECTED_FAILURES`(쉼표 구분)로 허용 목록 제어, 기본값 `sms,verification`.
  - known gap / 회복된 항목 / 응답 `checks`에 없는 이름을 각각 구분해 로그 출력. 기본 허용 목록이 "조용한 통과"로 굳지 않게 하는 장치.
  - 본문을 읽지 못한 `503`(토큰 거부, 비JSON)은 기존대로 회귀 처리.
  - 판정 함수 `export` + `pathToFileURL` 기반 CLI 직접 실행 가드. 테스트에서 import해도 `main()`이 돌지 않는다.
- `__tests__/scripts/launch-smoke-exit.test.ts` 신규. 회귀 테스트 8건.
- `docs/LAUNCH_CHECKLIST.md`, `.env.example` 문서 갱신.

## 검증

로컬 가짜 서버(`/api/launch/smoke`, `/api/health`, `/api/listings`, `/api/auth/phone/send`, `/api/admin/stats`)로 4개 시나리오 실행.

| 시나리오 | 응답 | 종료 코드 |
| --- | --- | --- |
| 전 항목 ok | 200 | 0 (+ 허용 목록 정리 안내) |
| sms·verification만 실패 | 503 | 0 (known gap) |
| sms·verification + database 실패 | 503 | 1 (`❌ 회귀 \| database`) |
| 503인데 본문이 JSON 아님 | 503 | 1 |

```bash
npx vitest run __tests__/scripts/launch-smoke-exit.test.ts   # 8 passed
node scripts/check-test-suite-health.mjs                      # 552 tests / 58 files / 죽은 스위트 0
```

전체 스위트에서 `__tests__/components/demo-network-isolation.test.tsx` 4건이 실패하지만, 이는 다른 에이전트가 작업 중인 untracked 신규 파일이며 이번 변경과 무관하다. 커밋에 포함하지 않았다.

`npm run test:ci`는 RTK 프록시가 `Missing script: "run"`으로 잘못 파싱하므로 `node scripts/check-test-suite-health.mjs`를 직접 실행했다.

## 설계 판단 하나

기본 허용 목록을 비워 두면 운영에서는 지금과 똑같이 항상 `exit 1`이라 수정 자체가 무의미해진다. 그래서 기본값에 `sms,verification`을 넣되, 허용된 항목도 매 실행마다 known gap으로 출력하고 조달이 끝나 통과로 바뀌면 목록에서 빼라고 알리도록 했다. 엄격하게 보려면 `LAUNCH_SMOKE_EXPECTED_FAILURES=` 로 실행한다.

## 남은 것

- 커밋 `f2c4792a`는 `main`에 있으나 push하지 않았다. `main`이 `origin/main`보다 5커밋 앞서 있고 그중 4건이 다른 에이전트 커밋이라 일괄 push는 CEO 판단이 필요하다.
- DOW-1131 소유를 DevOps로 재배정 요청, QA 재검증 대기.
- DOW-362의 남은 blocker는 DOW-1130(trust 회귀 테스트 5종 복구, 입주해) 하나. DevOps 미결 없음.

---

## 2026-09-21 DevOps 최종 리뷰 — 소유 복귀 후 잔여 구멍 1건 보강 (DOW-1131)

입주해가 `9afb7130`·`27a3191c`로 두 구멍(필수 항목 누락, 허용 목록 마스킹)을 메우고 소유를 DevOps로 넘겼다. 인수 검토에서 같은 계열의 잔여 경로 하나를 더 찾아 막았다.

### 잔여 구멍 — 필수 항목의 `ok`가 boolean이 아닐 때

기존 구현은 `value?.ok === false`인 항목만 실패로 셌고, `absentRequired`는 **항목의 부재**만 봤다. 그래서 항목이 존재하되 `ok`가 boolean이 아닌 경우가 판정 어디에도 걸리지 않았다.

```
database: { status: 'healthy' }   → ok 필드 없음 → 실패로 안 셈, 부재도 아님 → exit 0
runtime_env: { ok: 'true' }       → 문자열 → 같은 경로 → exit 0
```

route가 `addCheck(checks, name, ok, message)` 시그니처를 유지하는 한 나지 않지만, 응답 스키마를 바꾸는 리팩터링(예: `{ ok }` → `{ status }`)에서 그대로 터진다. 항목 드롭을 막아 놓고 스키마 변형을 열어 두면 방어가 반쪽이다.

### 수정

`scripts/launch-smoke.mjs`에 `malformedRequired`를 추가했다. 필수 항목이 존재하는데 `ok`가 `true`도 `false`도 아니면 실제 값을 찍고 회귀 처리한다.

```
❌ 회귀 | runtime_env | 필수 항목의 ok가 true/false가 아닙니다 (실제: "true") — 응답 스키마가 바뀌었는지 확인하세요
```

`ok: false`는 기존 `unexpected` 경로 그대로라 메시지가 중복되지 않는다(회귀 테스트로 고정).

### 운영 판단 2건 (입주해 질의 응답)

1. **`REQUIRED_CHECKS` 5종 선정** — 그대로 확정한다. `app/api/launch/smoke/route.ts`가 보고하는 항목은 총 7종(`database`, `jwt_secret`, `sms`, `email`, `storage`, `verification`, `runtime_env`)이고, 외부 조달에 묶인 `sms`·`verification`을 뺀 나머지가 정확히 이 5종이다. 전부 자체 인프라/설정 문제라 깨지면 예외 없이 회귀다. 가감 없음.

2. **필수 항목 마스킹 금지가 과한가** — 과하지 않다. 우회로를 두지 않는다. `launch-smoke`는 CI나 Fly 배포에 물려 있지 않다 — `package.json`의 `launch:smoke`로만 호출되는 수동 검증 도구이고, `.github/workflows` 어디에서도 부르지 않는다. 즉 이 스크립트가 exit 1을 내도 **배포가 막히지 않는다.** 긴급 상황에 필요한 건 "green으로 만드는 스위치"가 아니라 "무엇이 깨졌는지 읽고 사람이 판단하는 것"이고, 지금 구현이 그 정보를 정확히 준다. 우회 스위치를 넣는 순간 이 티켓이 없애려던 "예상된 degraded와 실제 회귀가 같은 신호" 문제가 그대로 돌아온다.

### 검증

가짜 서버 7개 시나리오, 불일치 0건. 아래 2건이 이번에 새로 막힌 경로다.

| 시나리오 | 기대 | 실제 |
| --- | --- | --- |
| 전 항목 ok | 0 | 0 |
| sms·verification만 실패 (known gap) | 0 | 0 |
| database 추가 실패 | 1 | 1 |
| database 항목이 응답에서 사라짐 | 1 | 1 |
| 허용목록으로 database 마스킹 시도 | 1 | 1 |
| **runtime_env의 ok가 문자열 `"true"`** | 1 | 1 |
| **jwt_secret에 ok 필드 없음** | 1 | 1 |

회귀 테스트 5건 추가(기존 16 + 5 = **21 통과**). 음성 대조로 `|| malformedRequired.length > 0`를 제거하면 신규 4건이 실패하는 것을 확인했다(통과만 보고 끝내면 테스트가 진짜인지 알 수 없다).

```
npx vitest run __tests__/scripts/launch-smoke-exit.test.ts   # 21 passed
npx vitest run                                               # 618 tests / 62 files / 0 failed / 죽은 스위트 0
npx tsc --noEmit                                             # 클린
npx eslint scripts/launch-smoke.mjs __tests__/scripts/launch-smoke-exit.test.ts   # 클린
```

`BASELINE_TESTS`는 613 → **618**로 갱신했다(신규 5건 반영, 실측과 일치).

### 남은 것

- push 안 함. `origin/main..main` 누적분은 [DOW-1133](/DOW/issues/DOW-1133)에서 일괄 판단한다.
- QA 재검증 대기. 운영 토큰으로 `npm run launch:smoke` → `echo $?`가 `0`, 로그에 sms·verification known gap 2줄, 필수 5종이 전부 로그에 보일 것.
