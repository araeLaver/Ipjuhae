# DOW-730 — demo route 네트워크 격리 수정

작성일: 2026-09-21
담당: 입주해
관련: DOW-729(구현), DOW-728(공개 전 QA 체크리스트)

## 배경

`/demo/public-mock/listings`는 외부 제출용 캡처 후보를 만드는 화면이고, 화면 안에
"운영 API, 운영 DB, 실제 계정을 호출하거나 표시하지 않습니다", "운영 API 호출 없음"을
고지로 싣고 있다. QA가 2026-08-03에 이 고지가 사실이 아니라고 판정했고(High 게이트 실패),
09-21 재검증에서도 같은 결함 2건이 그대로 살아 있음을 확인했다.

결함 2건 모두 `page.tsx`에는 `fetch(`가 없고 **transitive import를 타고** 들어왔다.

1. `GET /api/auth/me` — 공통 `PageContainer`의 `useEffect`가 마운트 시 호출
2. `POST /api/analytics/event` — root `Providers` → `PageViewTracker` →
   `lib/analytics-client.ts`의 `navigator.sendBeacon`. `isDev`는 `console.log`만 추가할 뿐
   네트워크 호출을 건너뛰지 않는다.

기존 경계 테스트(`__tests__/lib/public-mock-demo-boundary.test.ts`)는 파일 두 개의 텍스트만
정규식으로 검사해서 **6 pass인 채로 이 결함을 놓치고 있었다.** 거짓 안심을 주던 상태다.

## 수정

### 1. 격리 판정을 한 곳으로 — `lib/demo-isolation.ts` (신규)

`isDemoIsolatedPath(pathname)` 하나만 둔다. 컴포넌트마다 `startsWith('/demo')`를 흩뿌리면
새 훅이 추가될 때 조용히 빠지고 고지가 다시 거짓이 되기 때문에, 판정 지점을 단일화했다.

### 2. `components/providers.tsx` — demo 경로에서 클라이언트 훅을 마운트하지 않음

`usePathname()`으로 판정해 demo 경로면 `<>{children}</>`만 반환한다. `PageViewTracker`가
아예 트리에 올라가지 않으므로 조건 분기가 아니라 구조로 격리된다.

### 3. `components/service-worker-registrar.tsx` — 같은 경계 적용

production에서 demo route는 404지만, `NODE_ENV`가 잘못 주입된 환경에서도 `sw.js` 등록
요청이 남지 않게 경로로 한 번 더 막았다.

### 4. `app/demo/public-mock/listings/page.tsx` — 공통 shell 제거

`PageContainer`(Header가 `/api/auth/me` 호출) 대신 demo 전용 정적 wrapper를 쓴다.
화면 레이아웃(`max-w-6xl`, 배경)은 동일하게 유지했다.

## 회귀 테스트 — 소스 grep을 쓰지 않았다

신규: `__tests__/components/demo-network-isolation.test.tsx` (jsdom, 6 cases)

컴포넌트를 **실제로 render**하고 `fetch` / `navigator.sendBeacon` / `XMLHttpRequest.open`
세 진입점을 모두 감시한다. 핵심은 **대조군 2건**이다.

- 일반 경로(`/home`)에서 `Providers` 마운트 → `/api/analytics/event`가 **관측되어야** 통과
- `PageContainer` 단독 마운트 → `/api/auth/me`가 **관측되어야** 통과

관측기가 죽은 채로 "호출 0건"을 보고하는 거짓 통과를 막기 위한 장치다. 대조군이 깨지면
격리 단언도 같이 의미를 잃으므로 한 파일에 묶어 뒀다.

신규: `scripts/verify-demo-network-isolation.mjs` (`npm run demo:verify-isolation`)

실제 dev server + 실제 Chrome(`channel: 'chrome'`, 전용 Chromium 다운로드 불필요)으로
hydration 이후까지 관측한다. `waitUntil: 'networkidle'`은 쓰지 않는다 — 위반 요청이
계속 나면 idle이 오지 않아 timeout으로 죽고, "위반 2건"이 아니라 "스크립트 실패"로
보고돼 원인이 가려지기 때문(실제로 한 번 겪었다). `load` 후 3초 고정 관측으로 바꿨다.

## 검증 — 수정 전 실패를 먼저 확인했다

테스트가 결함을 실제로 잡는지 증명하려고 **수정을 되돌린 상태에서 먼저 돌렸다.**

| 검증 | 수정 전 | 수정 후 |
| --- | --- | --- |
| jsdom 회귀 테스트 | 격리 4건 **FAIL**, 대조군 2건 PASS | 6건 PASS |
| 브라우저 관측 스크립트 | `ping /api/analytics/event`, `fetch /api/auth/me` **위반 2건** | 비정적 요청 **0건** |
| dev server 로그 | `GET /api/auth/me 401`, `POST /api/analytics/event 200` | demo 요청에 `/api` 호출 없음 |

대조군은 수정 전후 모두 `/api/analytics/event`를 관측했다 — 관측기는 계속 살아 있었다.

기타:

- `npm run test:run` — 58 files / 552 tests pass
- `npm run build` — 성공
- production 404 조건(`assertDemoEnabled`)은 손대지 않았고 기존 단위 테스트가 계속 검증한다

## 남은 사항

- **외부 공개는 여전히 금지.** 보드 승인 전까지 캡처를 내보내지 않는다. 이번 수정은
  "고지가 사실이 되도록" 만든 것이지 공개 승인이 아니다.
- QA 재검증 요청함 — desktop `1440×1200`, mobile `390×844` 캡처 재취득 필요.
- **내 변경과 무관한 typecheck 오류 1건**: `__tests__/scripts/launch-smoke-exit.test.ts(3,1)`
  `TS2578: Unused '@ts-expect-error' directive`. 세션 중 다른 에이전트가 커밋한
  `f2c4792a` (DOW-1131)에서 들어왔다. `npm run launch:verify`가 이 때문에 막힌다.
