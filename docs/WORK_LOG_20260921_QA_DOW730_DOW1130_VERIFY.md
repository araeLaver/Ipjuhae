# QA 검증 기록 — DOW-730 / DOW-1130 (2026-09-21)

담당: QA
대상 커밋: `b52f2d17` (DOW-730 demo 네트워크 격리), `b6d8813c` (DOW-1130 trust 회귀 테스트 복구)

## 판정

| 이슈 | 판정 | 근거 |
|---|---|---|
| DOW-730 | **통과** | 실제 브라우저 관측에서 `/api/*` 호출 0건, desktop/mobile 양쪽 고지 가시 |
| DOW-1130 | **통과** | 변이 검증 4건 전부 FAIL 유도 성공 — 테스트가 실제로 가드를 잡음 |

## DOW-730 — demo route 네트워크 격리

08-03과 09-21 새벽에 두 번 차단했던 결함(`/api/auth/me`, `/api/analytics/event`)이
실제로 사라졌는지 **소스 grep이 아닌 실제 브라우저 관측**으로 확인했다.

검증 방법:

```bash
PUBLIC_MOCK_DEMO_ENABLED=1 npx next dev --hostname 127.0.0.1 --port 3010
node scripts/verify-demo-network-isolation.mjs http://127.0.0.1:3010
```

결과:

- demo 경로 요청 11건, `/api/*` 호출 **0건** (desktop 1440×1200 / mobile 390×844 양쪽)
- 대조군 `/home`에서 `/api/analytics/event` 관측됨 → **관측기가 살아 있음을 확인**
  (관측기가 죽은 채 "0건"을 보고하는 거짓 통과를 배제)
- console error / pageerror 0건
- 고지 가시성: `DEMO / 가상 데이터` 배너, 화면 고지, 검수 기준, 외부 발송 금지 모두 양쪽 viewport에서 가시
- 주소는 시·군·구/법정동 수준까지만, 번지·동호수·연락처 없음
- 추천 점수·신용등급 등 오인 표현 없음

jsdom 회귀 테스트(`__tests__/components/demo-network-isolation.test.tsx`)도 확인했다.
대조군 2건이 "호출이 나야 통과"하는 구조라 감시기 사망 시 같이 깨진다 — 설계가 옳다.

### 별건: 외부 폰트 CDN 요청 (차단 사유 아님)

demo 화면은 `cdn.jsdelivr.net`으로 stylesheet/font **2건**을 보낸다.
`app/globals.css`의 Pretendard `@import`이며 [DOW-881](/DOW/issues/DOW-881)에서
CSP `style-src`/`font-src`에 **의도적으로 허용**된 전역 테마 의존성이다.
이번 수정이 만든 것이 아니고, 화면 고지("운영 API·운영 DB·실제 계정 미사용")와도
모순되지 않으므로 게이트 실패로 보지 않는다.

**다만 08-03 QA 보고의 "외부 origin 요청 0건"은 사실과 달랐다.** 정정한다.

### harness 수정 — 외부 origin 관측 불능 해소

`scripts/verify-demo-network-isolation.mjs`의 `isStaticAsset()`이
non-`/api/` 이기만 하면 통과시켜서 **외부 origin 요청을 구조적으로 관측할 수 없었다.**
위 2건을 "0건"으로 보고한 원인이다. origin 판정을 분리했다.

- 같은 origin일 때만 정적 자산으로 인정
- 허용 목록(`ALLOWED_EXTERNAL_ORIGINS`)은 Pretendard CDN 1건, **허용 사실을 항상 출력**한다.
  [DOW-1131](/DOW/issues/DOW-1131)에서 정한 "허용 목록이 조용히 마스킹하지 않는다" 원칙과 같다.
- 목록에 없는 외부 origin은 위반으로 판정

되돌려 실패 확인: 허용 목록 항목을 비우고 실행 → 위반 2건 보고, exit 1.
즉 관측이 실제로 동작한다.

## DOW-1130 — trust platform 회귀 테스트 복구

복구된 4파일이 "존재하지만 아무것도 못 잡는" 테스트인지 **변이 검증**으로 확인했다.
운영 route의 가드를 하나씩 고의로 깨고 대응 테스트가 FAIL 하는지 봤다.

| 변이 | 결과 |
|---|---|
| `disputes`: 중복 이의제기 409 가드 제거 | 잡음 |
| `disputes`: admin 전용 PATCH 가드 제거 | 잡음 |
| `access-logs`: 비-admin 본인 스코프 강제 제거 | 잡음 |
| `access-logs`: limit 200 상한 제거 | 잡음 |

4건 전부 FAIL을 유도했다. 변이 후 원본 복원도 `git diff` 공백으로 확인했다.

테스트는 route handler를 실제로 import하고 `@/lib/db`·`@/lib/auth`만 mock 한다.
route 로직 자체는 실행되므로 계층이 옳다.

이슈가 지목한 운영 배포 route 4종의 커버리지 상태:

| route | 커버 테스트 |
|---|---|
| `app/api/access-logs/route.ts` | `__tests__/api/access-logs.test.ts` |
| `app/api/consent/route.ts` | `__tests__/api/consent.test.ts` |
| `app/api/consent/events/route.ts` | `__tests__/api/consent.test.ts` |
| `app/api/references/[id]/disputes/route.ts` | `__tests__/api/reference-disputes.test.ts` |

`report-aggregates` / `trade-condition-hints`는 옛 테스트 파일 목록에는 있었으나
해당 route가 현재 `main`에 존재하지 않는다. 복구 대상이 아니다.

## 전체 회귀

`npx vitest run` → **613 pass / 0 fail**
