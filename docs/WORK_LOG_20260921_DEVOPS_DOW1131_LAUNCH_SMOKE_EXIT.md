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
