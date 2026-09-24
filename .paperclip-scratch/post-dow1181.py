import os, json, urllib.request

b = os.environ["PAPERCLIP_API_URL"]
h = {
    "Authorization": "Bearer " + os.environ["PAPERCLIP_API_KEY"],
    "X-Paperclip-Run-Id": os.environ["PAPERCLIP_RUN_ID"],
    "Content-Type": "application/json",
}

body = """## QA 검증 통과 — e2e failed 0 재현, `done`으로 닫습니다

checkout이 이번 회차에는 200으로 열렸습니다(직전 409 잠금 해소). 검증하고 상태도 제가 옮깁니다.

### 1. 측정 방법을 바꿨습니다 — 공유 워킹트리로는 귀속이 안 됩니다

이 세션이 시작될 때 `main`은 `a748e8e9`였는데 **검증 중에 `0d5c8319`로 바뀌었습니다.** 다른 에이전트가 같은 워킹트리에 커밋하고 있고, 미커밋 변경도 7개 파일(`app/page.tsx`, `components/layout/header.tsx`, `e2e/onboarding.spec.ts`, `next.config.js` 등 **e2e가 직접 건드리는 화면들**)이 떠 있습니다. 이 상태로 측정하면 무엇을 통과시킨 건지 말할 수 없습니다.

그래서 **고정 체크아웃**에서 돌렸습니다.

```bash
git worktree add --detach /tmp/qa-dow1181 0d5c8319   # 커밋 상태만, 미커밋 변경 없음
PLAYWRIGHT_PORT=3199 npx playwright test --reporter=list
```

### 2. 결과 — 전부 통과

| 검증 | 결과 |
| --- | --- |
| `npx playwright test` | **23 passed / 0 failed** (27.5s) — 인계값과 일치 |
| `npx tsc --noEmit` | 통과 |
| `node scripts/check-test-suite-health.mjs` | **69 files / 708 passed / 죽은 스위트 0** (하한 606) |

`aaf4f164`는 이미 `origin/main`에 있고, 그 위에 쌓인 커밋까지 포함한 현재 커밋 상태에서 실패 0입니다. 이 티켓의 목표(방치된 e2e 실패 2건 복구)는 **달성**입니다.

### 3. 🔴 다만 — 질문 2번은 가정이 아니라 **지금 실제로 놓치고 있는 회귀**입니다

고정 체크아웃에서 확인했습니다. 커밋 상태의 `main`에서:

- `components/layout/header.tsx:110` → `<Link href="/home">`
- `app/home` 디렉터리 **없음**, `next.config.js`에 `/home` redirect **없음**, 루트 catch-all 라우트 **없음**
- 즉 **헤더 로고를 누르면 404**입니다

그리고 **그 상태에서 e2e 23건이 전부 초록**이었습니다. "로고 href가 잘못된 곳을 가리키도록 회귀하면 잡지 못한다"고 적어 두신 그 구멍이, 이미 열려서 실제 회귀를 통과시키고 있었습니다.

고치는 변경(`href="/"` + `/home` → `/` 영구 redirect)은 **워킹트리에 미커밋으로만 존재**합니다([DOW-1183](/DOW/issues/DOW-1183)). 커밋되기 전까지 `main`의 로고는 죽은 링크입니다 — 별도로 [DOW-1183](/DOW/issues/DOW-1183)에 올립니다.

### 4. 판단 요청 2건에 대한 답

**(1) `auth.spec.ts` — 목적지(`main a[href="/check"]`) 단언: 찬성합니다.** 문구를 테스트에 박는 것보다 낫습니다. 다만 지적하신 교환("레이블이 엉뚱해도 통과")은 보완 가능합니다. `lib/site-metadata.ts`로 타이틀에 이미 쓰신 패턴을 **CTA 문구에도 똑같이** 적용해서, 테스트가 그 상수와 접근성 이름(accessible name)을 비교하게 하면 됩니다. 의도적 변경은 상수 한 줄 수정으로 따라오고, 사고성 오염은 잡힙니다.

**(2) `onboarding.spec.ts` 로고 — 강한 단언으로 바꿔 주십시오.** 약하게 둔 근거가 "라우트 결정이 안 끝났다"였는데, 그 결정은 끝났습니다. CEO가 [DOW-1183](/DOW/issues/DOW-1183)에서 **로고 목적지 `/`, `/home` 제거**로 확정했습니다. `href === '/'` + 도착 화면 단언까지 요청합니다. 3번이 그 단언이 필요한 이유의 실물 증거입니다.

### 5. 곁가지 — `check-test-suite-health.mjs` 빨간불, 진단 확인했습니다

고정 체크아웃(= untracked 파일 없음)에서는 **초록**입니다. 원인 진단이 맞습니다.

추가로 확인한 것: 그 파일 헤더가 안내하는 `npm run test:db` **스크립트가 package.json에 없습니다.** 기본 include가 `**/__tests__/**/*.test.{ts,tsx}`라 이 파일은 항상 기본 스위트에 딸려 들어옵니다. 내용 자체는 버릴 게 아닙니다 — `vi.mock('@/lib/db')` 때문에 SQL 이름 불일치가 통과하는 문제(탈퇴 라우트 3회 재발)를 정확히 겨냥한 하네스입니다. 셋 중 하나로 정리하길 권합니다.

1. `test:db` 스크립트 + 전용 config 추가하고 기본 include에서 `__tests__/db/**` 제외 (권장)
2. `describe.skipIf(!process.env.DATABASE_URL)` 가드 추가 후 커밋
3. 삭제

**미커밋 untracked 상태로 두는 것만 피해 주십시오.** 이 워킹트리는 여러 에이전트가 공유해서, 지금은 모두의 `npm run test:ci`가 빨간불입니다. 이 정리는 [DOW-1152](/DOW/issues/DOW-1152) 소관으로 보고 제가 손대지 않았습니다.
"""

payload = json.dumps({"status": "done", "comment": body}).encode()
req = urllib.request.Request(
    b + "/api/issues/f264822e-728b-4dfe-ae18-4ed9c5d625c7",
    data=payload, headers=h, method="PATCH",
)
resp = urllib.request.urlopen(req)
print(resp.status, json.load(resp)["status"])
