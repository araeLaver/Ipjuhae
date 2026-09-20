# 워크로그 2026-09-21 — 앱 계측 403 해소, /check 익명화, CI 초록 복구

대상 티켓: DOW-1067 (`/check` 결과 화면 → 테스터 전환 익명 계측 3종)
커밋: `81f0d20d` → `8c51b4d2` → `830da030` (모두 `origin/main`, 배포 완료)

## 1. 앱 계측 3종이 프로덕션에서 전량 버려지던 문제

QA 검수에서 잡혔다. `mobile/src/services/analytics.ts`의 `trackAnonymous`가 보내는 요청이
`middleware.ts`의 CSRF 검사에서 403으로 끊겨 라우트까지 도달하지 못했다.

`checkCsrf()`는 POST에 대해 셋 중 하나를 요구한다.

1. `x-mobile-client: true` 헤더
2. 호스트와 일치하는 `Origin`
3. 호스트와 일치하는 `Referer`

React Native의 `fetch`는 브라우저가 아니라 `Origin`도 `Referer`도 붙이지 않는다.
**토큰이 자동으로 붙는 `apiClient`를 피해 맨 `fetch`로 바꾸면서 CSRF 우회 헤더까지 같이 떨어진 것**이
원인이었다. 익명성을 지키려던 조치가 수집 자체를 0으로 만들었고, 화면은 멀쩡하고 에러도 안 나서
숫자가 0인 걸로만 보였다.

수정은 `x-mobile-client: 'true'` 한 줄. 이 헤더는 인증과 무관하게 "브라우저가 아닌 앱 요청"임을
알리는 용도라 익명성에는 영향이 없다. `Authorization`은 여전히 붙이지 않는다.

교훈은 `docs/` 기준으로 이미 알려진 함정과 같다 — **앱에서 `apiClient`를 우회하면
`x-mobile-client`를 잃는다.** 우회할 때는 이 헤더를 직접 실어야 한다.

## 2. `/check`의 `page_view`가 계정에 묶이던 문제

깔때기 3종은 익명 전용 경로로 분리했는데 같은 화면의 `page_view`는 여전히 `getCurrentUser()`를
타고 있었다. "가입 없이 쓰는 화면"이라는 티켓 전제와 어긋나 경로 기반으로 막았다.

- `lib/analytics-events.ts`에 `ANONYMOUS_PATHS`(현재 `/check`)를 두고 `resolveAnonymousProperties()`
  한 곳에서 판정한다 (단일 출처 유지)
- 익명 판정이 서면 라우트가 `getCurrentUser()`를 **호출조차 하지 않는다**
- 경로는 쿼리·해시를 떼고 목록의 값으로 정규화해 저장한다. 하위 경로(`/check/...`)는 포함,
  `/checkout`은 걸리지 않는다
- **랜딩(`/`)은 종전대로** 계정·세션과 함께 저장된다. `/admin/waitlist`가 그 행으로 채널별 방문을
  세기 때문이며, 회귀 테스트로 고정했다

## 3. CI가 두 번 깨진 경위 — 원인은 한 가지

1번 수정과 함께 넣은 `__tests__/mobile/analytics-csrf.test.ts`가 `mobile/src`를 import하면서
CI를 깼다. **로컬에는 `mobile/node_modules`가 있고 CI에는 없다**는 환경 차이가 두 번 다 원인이다.

| 커밋 | 증상 | 원인 |
| --- | --- | --- |
| `8c51b4d2` | Type Check 실패 (`Cannot find module 'expo-constants'`) | tsconfig `exclude`는 **루트 파일 목록에만** 적용되고 import를 따라간 파일에는 적용되지 않는다 |
| `830da030` | vitest 스위트가 로드 단계에서 사망 (TSCONFIG_ERROR) | vitest가 `mobile/src/services/analytics.ts`를 transform하며 `mobile/tsconfig.json`의 `extends: expo/tsconfig.base`를 해석하는데 CI에 Expo 의존성이 없다 |

`8c51b4d2`의 스텁 매핑은 `tsc`만 통과시켰고 vitest는 못 고쳤다. 그 사이 main이 red였다
(run `35530704239`). 최종 해법은 **앱 모듈을 import하지 않고 소스를 텍스트로 읽어 검사**하는 것.
웹 저장소의 vitest가 Expo 전용 프로젝트를 건드리지 않게 되어 환경 차이 자체가 사라졌다.

### 그 대가로 테스트가 약해졌다

원래는 `trackAnonymous()`를 실제로 호출해 나가는 요청 헤더를 봤다. 지금은 형태 검증이다.

- 지키는 것: `x-mobile-client: 'true'`가 코드에 있는가 / `Authorization`·`credentials`·`apiClient`가 없는가
- 못 지키는 것: 런타임에 그 헤더가 정말 실려 나가는지

앱 계측의 런타임 보증은 앱 빌드로 한 번 돌려보는 것밖에 없고, 그건 QA 재검수 항목으로 넘겼다.

## 4. 확인한 것

| 항목 | 결과 |
| --- | --- |
| 로컬 테스트 | 495개 전부 통과 |
| CI (`35531255712`) | 전부 초록 (`830da030`) |
| Fly Deploy (`35531398187`) | 성공 |
| 프로덕션 `/check` | 비로그인 `200`, 번들 `app/check/page-92b606c86c59be19.js` |
| 번들 내 이벤트 이름 3종 | 전부 존재 |
| 프로덕션 CSRF (헤더 없음) | `403 CSRF_INVALID` |
| 프로덕션 CSRF (`x-mobile-client: true`) | `200 {ok:false, reason:"invalid_event"}` |

CSRF 확인은 저장되지 않는 이름(`qa_probe_not_a_real_event`)으로만 두드렸다. `isEventName()`에서
막히므로 분석 데이터는 오염되지 않았다.

## 5. 남은 것

DOW-1067은 QA 재검수로 넘겼다. 내가 확인하지 못한 항목:

- 앱 빌드로 끝까지 돌려 `analytics_events`에 3종이 실제로 쌓이는지
- 로그인 상태로 `/check` 진입 시 `page_view` 행의 `user_id`·`session_id`가 비어 있는지
- `/admin/analytics` 30일 표가 날짜별로 읽히는지 (완료 기준)
