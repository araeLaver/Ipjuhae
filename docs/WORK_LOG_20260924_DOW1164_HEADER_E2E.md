# 2026-09-24 — DOW-1164 마감 · DOW-1181 e2e 복구

담당: 입주해 / 런 `dc3194a8`

## 한 줄

헤더 인증 수정(DOW-1164)을 QA 지적 1건 반영해 닫고, 그 과정에서 드러난 **09-17 전환 이후 방치된 e2e 실패 2건**을 복구해 전체 e2e를 처음으로 failed 0으로 만들었다.

## 무엇을 했나

### 1. DOW-1164 — 로그아웃 실패 테스트 locator (`b26cbce1`)

QA가 [DOW-1178]에서 "제품 수정은 통과, 남은 건 locator 한 줄"로 판정했다.

`e2e/header-mobile.spec.ts:54`의 `getByRole('alert')`가 strict mode violation으로 죽었다. Next.js가 모든 페이지에 넣는 `__next-route-announcer__`가 항상 `role="alert"`를 갖고 있어 항상 2개가 잡힌다.

문구로 좁히는 것에서 멈추지 않았다. QA가 **"55~57행이 한 번도 실행된 적 없다"**고 짚었기 때문에, logout 라우트를 호출 횟수 기반으로 바꿔 **첫 시도 실패 → 재시도 성공**까지 테스트가 실제로 태우게 했다. 실패 안내, 메뉴 유지, 재오픈, 두 번째 시도 성공 시 메뉴 닫힘, `logoutCalls === 2`를 단언한다. QA가 사본으로만 확인했던 구간이 저장소 테스트로 남았다.

`npx playwright test e2e/header-mobile.spec.ts` → 6 passed.

### 2. DOW-1157 — 중복 종료

D1·D2가 DOW-1164와 동일 범위여서 `640dfc2f`로 함께 해소됐다. 이 티켓에만 있던 U3(로고 목적지)는 `/home` 308 리다이렉트 결정과 중복되므로 손대지 않았다.

### 3. DOW-1181 — e2e 실패 2건 복구 (`aaf4f164`)

QA가 "이 수정과 무관한 기존 실패 2건"으로 보고한 것. 티켓을 새로 올리고 같은 회차에 처리했다.

**`e2e/auth.spec.ts`** — 실패가 타이틀 한 줄이 아니었다. 그 테스트는 **옛 매물 랜딩 화면 전체**를 기대하고 있었다(`신뢰받는 매물 찾기`, `매물 둘러보기`). 둘 다 지금 `/`에 없고 `app/home/page.tsx`로 옮겨간 문구다. 타이틀에서 먼저 멈춘 덕에 나머지 두 줄이 안 드러났을 뿐이다.

- `lib/site-metadata.ts` 신설 → `/` 타이틀을 `app/page.tsx`와 e2e가 같은 상수로 본다
- 대표 행동은 링크 **문구**가 아니라 **목적지**(`/check`)로 확인, 제목은 `level: 1` 존재만 확인

**`e2e/onboarding.spec.ts`** — 기대값 `/`를 `/home`으로 바꾸지 **않았다.** 그러면 `/home` 정리 때 세 번째로 깨진다. 로고가 **가리키는 곳으로 실제로 데려가는지**만 확인하게 바꿨다.

## 검증

```
npx playwright test    23 passed / 7 skipped / 0 failed   (직전 20/3/7)
npx tsc --noEmit       통과
npx vitest run         66 files / 681 passed  (아래 예외 제외 시)
```

## 알게 된 것 — 기록해 둘 값

### `scripts/check-test-suite-health.mjs` 빨간불의 진짜 원인

내 변경이 아니다. **untracked** `__tests__/db/trust-routes-real-db.test.ts`가 `DATABASE_URL` 없으면 파일 단위로 죽는다. 제외하면 66 files / 681 passed 전량 통과.

[DOW-1152] 잔여물로 보인다. 같은 작업의 `__tests__/lib/db-ssl.test.ts`는 커밋됐는데 이건 빠졌다. **지금 상태로 커밋하면 CI에 DB가 없어 바로 빨간불** — DOW-1181이 고치려던 것과 똑같은 함정이다. 그래서 커밋에 넣지 않았다.

### DOW-1159가 승인만 있고 집행이 없다

`/home` 308 리다이렉트가 승인됐지만 DOW-1159 자체는 **"조사·보고만" 범위로 done**이고, `app/home/page.tsx`는 지금도 살아 있다. 집행 티켓이 보이지 않는다. CEO에게 확인 요청했다.

### 티켓을 todo에서 빼낼 수 없는 조합

DOW-1181은 내가 만들고 내가 배정받았는데 두 경로가 다 막혔다.

- `POST /checkout` → 409 (`executionRunId` 잔존, 내 현재 런이 아님) — [DOW-1160] 증상
- `PATCH status` → 409 `Invalid issue status transition: todo -> done`. `todo -> in_review`도 동일

`todo`에서 나가는 유일한 경로가 `in_progress`이고 그건 checkout을 거쳐야 한다. **댓글과 assignee 변경은 되고 checkout·상태 전이만 막힌다.** QA로 인계해 닫아 달라고 요청했다.

## 미push 스택 — 4건, 아직 사용자 화면에 없다

| 커밋 | 성격 |
|---|---|
| `640dfc2f` | 운영 런타임 — 헤더 인증·역할 메뉴 |
| `6dff37fb` | 운영 런타임 — DB SSL 판정 |
| `b26cbce1` | 테스트 단독 |
| `aaf4f164` | 테스트 + `app/page.tsx` 1줄 |

운영 런타임 포함이라 CEO 결정 사항. [DOW-1133]에 현황과 판단 재료를 갱신하고 승인 요청했다. **직전까지 e2e 3건이 실패였으므로 그 상태로 올렸으면 CI 실패 → Fly 배포 중단으로 스택 전체가 막혔다.** 지금 처음으로 게이트가 전부 초록이다.

## 남은 한계 — "확인됨"으로 읽히지 않게

**실계정 로그인 경로는 여전히 미검증이다.** 헤더 검증은 전부 `/api/auth/me` stub 기반 UI 레벨이고, 세션 쿠키 발급·만료·역할 클레임은 확인하지 않았다. 로컬 DB가 없어 지금은 방법이 없다. [DOW-1152]로 SSL 판정을 고쳤으니 로컬 DB가 서면 그때 태운다.

[DOW-1133]: /DOW/issues/DOW-1133
[DOW-1152]: /DOW/issues/DOW-1152
[DOW-1160]: /DOW/issues/DOW-1160
[DOW-1178]: /DOW/issues/DOW-1178
