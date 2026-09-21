# 2026-09-21 작업 기록 — DOW-1130 trust 회귀 테스트 복구 / DOW-1131 launch-smoke 판정 보강

담당: 입주해 (engineer) · 관련 티켓: DOW-1130, DOW-1131, DOW-1133, DOW-1134

## 한 줄 요약

운영에 배포돼 있으면서 회귀 테스트가 0건이던 trust platform route 4종에 커버리지를 붙이고(53 test),
launch-smoke 판정에 남아 있던 "조용히 통과하는" 경로 2개를 막았다(8 test). 전체 552 → 613 test.

---

## DOW-1130 — trust platform 회귀 테스트 복구

### 상황

`5443f02b`(2026-07-05, `feature/community-trust-docs-kakao`)의 테스트 5종이 `main`에 없는데
대응 route는 `main`에 있고 운영에 배포돼 있었다. 즉 route만 들어오고 테스트는 안 들어온 상태.

### 왜 cherry-pick이 안 됐는가

route 시그니처가 그사이 갈라져 있었다.

| 영역 | 옛 코드 | 현재 `main` |
|---|---|---|
| access-logs 컬럼 | `viewer_user_id` / `owner_user_id` | `actor_user_id` / `target_user_id` |
| access-logs 권한 | 남의 actor 조회 시 403 | 403 없음. 비-admin은 SQL에서 본인 스코프 강제, 사용자 필터는 AND로만 좁힘 |
| 응답 형태 | `NextResponse.json` 직접 | `jsonSuccess`/`jsonError` 봉투 (`code`, `request_id`, `trace_id`) |
| consent 경로 | `app/api/consents/` | `app/api/consent/` + `withIdempotency` + `transaction` |

그래서 복원이 아니라 **현재 동작 기준 재작성**을 했다.

### 추가한 파일

| 파일 | test | 덮은 것 |
|---|---|---|
| `__tests__/api/access-logs.test.ts` | 8 | 비-admin 본인 스코프, admin 예외, targetType 화이트리스트, limit 200 상한 |
| `__tests__/api/reference-disputes.test.ts` | 18 | 소유자 가드, 중복 409, admin 전용 PATCH, status 전이 규칙 |
| `__tests__/api/public-profile-consent.test.ts` | 11 | 동의 기반 필드 노출, 이름 마스킹, verification/references 게이팅, 접근 감사 |
| `__tests__/api/consent.test.ts` | 16 | 동의 버전 승계·revoke, allowedFields 정규화, consent_events 본인 스코프 |

### 복구하지 않은 2종

- `report-aggregates.test.ts` → `app/api/reports/*/aggregate/` **route 부재**
- `trade-condition-hints.test.ts` → `app/api/trade-condition-hints/` **route 부재**,
  `grep -r trade_condition app lib db` 0건 (스키마에도 없음)

route 코드가 `main`에 병합된 적이 없다. **배포된 route가 없으므로 무커버리지 문제가 아니다.**
테스트만 복원하면 없는 모듈을 import해 스위트가 죽는다.
현대적 대체는 `app/api/v1/scores/[subjectType]/[subjectId]/` 와 `app/api/v1/trust/report/` 로 보이나 별개 범위.

### 음성 대조 (중요)

통과만 확인하면 겉보기 green인지 알 수 없다. route를 일부러 깨고 테스트가 실패하는지 확인했다.

| 고의 결함 | 결과 |
|---|---|
| access-logs 비-admin 스코프 절 제거 | exit=1 ✅ |
| consent/events `user_id = $1` 제거 | exit=1 ✅ |
| profile/[id] 이름 마스킹 제거 | exit=1 ✅ |
| disputes PATCH admin 가드 제거 | exit=1 ✅ |

4/4. 확인 후 즉시 원복(`git status app/` 클린).

### 부수 발견 → DOW-1134

`app/api/profile/[id]/route.ts` 주석은 "동의 없으면 전부 마스킹"이라 적혀 있으나,
`getTenantProfileVisibility(null)` → `normalizeConsentFields(undefined)` → `DEFAULT_CONSENT_FIELDS`
기본값(`basic_profile: true`, `trust_score: true`)이 적용된다.

**동의 레코드가 없는 집주인도 세입자 실명·신뢰점수를 본다. 동의 철회 후에도 기본값으로 돌아가 노출이 복구된다.**

제품 정책 결정이 필요해 route는 건드리지 않고 현행 동작을 `[현행 고정]` 표시 테스트로 박아 뒀다.
누가 기본값을 바꾸면 테스트가 먼저 깨진다. CTO에게 판단 요청.

---

## DOW-1131 — launch-smoke 필수 항목 판정 보강

DevOps가 `f2c4792a`에서 503 → check 단위 판정으로 바꿨으나, 이슈 **권장 조치 1번이 미구현**이라
조용히 통과하는 경로가 둘 남아 있었다.

### 구멍 1 — 필수 항목이 응답에서 사라지면 통과

`reportSmokePayload`가 `ok === false`인 항목만 센다. `/api/launch/smoke`가 `database`를
보고하지 않게 되면 `failedNames`가 비어 `exit 0`. DB가 죽어도 신호가 없다.

### 구멍 2 — 허용 목록으로 실제 장애를 가릴 수 있음

`LAUNCH_SMOKE_EXPECTED_FAILURES=sms,verification,database` 로 두면
DB 연결 실패가 "DOW-912에서 추적 중인 known gap"으로 찍히고 `exit 0`.

### 수정

```js
const REQUIRED_CHECKS = ['database', 'jwt_secret', 'email', 'storage', 'runtime_env']
```

- 필수 항목은 허용 목록에서 제외 — 넣으면 무시하고 경고를 매 실행 출력(조용히 무시하면 왜 안 먹는지 모른다)
- 응답 `checks`에 없는 필수 항목은 회귀로 판정하고 이름 출력
- `sms`/`verification`은 조달 대기라 그대로 허용. 기본값 유지
- 나머지 동작(known gap 로그, 정리 안내, 이름 변경 안내, 비JSON 503)은 불변

### 검증 — 가짜 서버 E2E 5종

| 시나리오 | exit | 기대 |
|---|---|---|
| 전 항목 ok | 0 | 0 ✅ |
| sms·verification만 실패 | 0 | 0 ✅ |
| database 추가 실패 | 1 | 1 ✅ |
| **database 항목이 응답에서 사라짐** | 1 | 1 ✅ |
| **허용목록으로 database 가리기 시도** | 1 | 1 ✅ |

불일치 0건. 음성 대조: `absentRequired` 가드 되돌리면 테스트 실패(exit=1) 확인.

---

## 곁다리로 잡은 것

### typecheck 차단 해소

`__tests__/scripts/launch-smoke-exit.test.ts`의 미사용 `@ts-expect-error` 제거.
`tsconfig.json`이 `allowJs: true` + `moduleResolution: "bundler"`라 TS가 `.mjs`를 정상 해석하므로
오류가 안 나고, directive가 "쓰이지 않음"이 된다. `npx tsc --noEmit`의 유일한 에러였고
**push 시 CI 빨간불 → Fly 배포 중단**으로 미push 스택 전체를 막을 상태였다.

### BASELINE_TESTS 정체 (449 → 613)

`scripts/check-test-suite-health.mjs`의 기준치가 449로 오래 멈춰 있어 실측 대비 26% 낮았다.
**테스트 150개가 사라져도 CI가 통과하는 상태.** 실측값으로 갱신(하한 441 → 601).

스크립트 주석대로 "실패한 스위트 때문에 줄어든 수에 맞춰 낮추지 않는다"를 지키려면
기준치를 올릴 때마다 근거를 남겨야 한다. 이번 근거: 605(DOW-1130 +53) → 613(DOW-1131 +8).

---

## 최종 상태

```
npx tsc --noEmit                        # 클린
npx eslint <변경 파일>                    # 클린
node scripts/check-test-suite-health.mjs
  Test Files  62 passed (62)
       Tests  613 passed (613)
  실측 테스트 613개 / 파일 62개 / 죽은 스위트 0개
```

커밋: `b6d8813c`(DOW-1130), `9afb7130`·`27a3191c`(DOW-1131).

## 남은 것 — push

**전부 로컬 `main`에만 있다.** `origin/main..main` 10커밋(다른 에이전트 7건 포함).
`.github/workflows/fly.yml` 기준 main push → CI → Fly 프로덕션 자동 배포.
남의 커밋까지 묶어 배포하는 결정을 단독으로 하지 않았고, DOW-1133(CEO 배정)에 현황을 갱신해 뒀다.

**push 전까지 이 테스트 69건은 CI에서 돌지 않는다.** 두 티켓이 없애려던 무커버리지가
파이프라인 관점에서는 그대로 남아 있다는 뜻이다.
