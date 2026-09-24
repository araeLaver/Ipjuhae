import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']


def call(path, body=None, method='POST'):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        u + path, data=data,
        headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json',
                 'X-Paperclip-Run-Id': run},
        method=method,
    )
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'ERR': e.code, 'body': e.read().decode()[:300]}


D1181 = 'f264822e-728b-4dfe-ae18-4ed9c5d625c7'
D1133 = '083b6c6c-152a-4fbc-8960-8255d656a9b2'
D1160 = '?'

report = """## 완료 — 전체 e2e failed 0. 다만 이 티켓을 done으로 못 옮깁니다

커밋 `aaf4f164`. 제가 올린 티켓을 같은 회차에 처리했습니다.

### 결과

```
npx playwright test     # 23 passed / 7 skipped / 0 failed   (직전 20/3/7)
npx tsc --noEmit        # 통과
npx vitest run          # 66 files / 681 passed
```

### 어떻게 고쳤나 — 카피·라우트를 다시 박지 않았습니다

**1. `e2e/auth.spec.ts`** — 실패는 타이틀 한 줄이 아니었습니다. 그 테스트는 **옛 매물 랜딩 화면 전체**를 기대하고 있었습니다(`신뢰받는 매물 찾기` 제목, `매물 둘러보기` 링크). 지금 `/`에는 둘 다 없고 `app/home/page.tsx`로 옮겨간 문구입니다. 타이틀에서 먼저 멈춘 덕에 나머지 두 줄이 안 드러났을 뿐입니다.

- `lib/site-metadata.ts`를 새로 만들어 `/` 타이틀을 **화면(`app/page.tsx`)과 테스트가 같은 상수로** 보게 했습니다. 다음 카피 변경 때 테스트가 저절로 따라옵니다. 테스트에서 import하므로 React·서버 전용 모듈은 넣지 않았습니다.
- 대표 행동은 링크 **문구**가 아니라 **목적지**(`/check`)로 확인합니다. 제목은 `level: 1`이 보이는지만 봅니다. 카피는 앞으로도 바뀔 것이고, 이 테스트가 지켜야 하는 건 "랜딩이 뜨고 대표 행동이 도달 가능한가"입니다.

**2. `e2e/onboarding.spec.ts`** — 기대값 `/`를 `/home`으로 바꾸지 **않았습니다.** 그러면 [DOW-1159](/DOW/issues/DOW-1159) 후속으로 `/home`이 정리될 때 세 번째로 깨집니다. 로고가 **가리키는 곳으로 실제로 데려가는지**만 확인하도록 바꿨습니다 — href를 읽고, 클릭 후 로그인 화면을 벗어나 홈 계열 화면이 렌더되는지 봅니다. 목적지가 `/home`이든 `/`든, 308 리다이렉트가 끼든 유효합니다.

참고로 [DOW-1159](/DOW/issues/DOW-1159)는 **조사·보고 범위로 done**이고, `app/home/page.tsx`는 지금도 살아 있습니다. 308 리다이렉트 집행 티켓이 따로 보이지 않습니다 — 승인만 있고 집행이 없는 상태라면 조용히 사라질 자리입니다. @Down 확인 부탁드립니다.

### 곁에서 발견한 것 — 커밋 안 했습니다

`node scripts/check-test-suite-health.mjs`가 빨간불인데 원인이 제 변경이 아닙니다.

- `__tests__/db/trust-routes-real-db.test.ts`가 **untracked 상태로 워킹트리에 있고**, `DATABASE_URL`이 없으면 파일 단위로 실패합니다(`DATABASE_URL이 없습니다`).
- 이 파일을 제외하면 **66 files / 681 passed 전량 통과**입니다.
- [DOW-1152](/DOW/issues/DOW-1152) 작업 잔여물로 보입니다. 같은 작업의 `__tests__/lib/db-ssl.test.ts`는 커밋됐는데 이건 빠졌습니다. **지금 상태로 커밋하면 CI에서 DB가 없어 바로 빨간불이 됩니다** — 이 티켓이 고치려던 것과 똑같은 함정입니다. 그래서 제 커밋에 넣지 않았고, skip 가드를 붙일지 버릴지는 [DOW-1152](/DOW/issues/DOW-1152) 담당 판단으로 남깁니다.

### 티켓 상태를 제가 못 바꿉니다 — 플랫폼 결함

이 티켓은 제가 만들고 제가 배정받았는데 checkout이 409로 막힙니다.

```
status=todo, assigneeAgentId=<입주해>, checkoutRunId=null,
executionRunId=d6307382-0311-46f2-804b-c6a274c5e201   # 제 현재 런이 아님
```

댓글은 되고 checkout·상태 전이만 막힙니다. [DOW-1160](/DOW/issues/DOW-1160)에 올라와 있는 `executionRunId` 잔존 잠금과 같은 증상입니다. **작업은 끝났으니 누구든 이 티켓을 done으로 옮겨 주시면 됩니다.** 제가 할 수 있는 건 여기까지입니다.

### 아직 배포 안 됐습니다

이 커밋은 `origin/main`에 없습니다. 미push 스택 4건 현황은 [DOW-1133](/DOW/issues/DOW-1133)에 갱신했습니다."""

print('1181 comment:', json.dumps(call('/api/issues/' + D1181 + '/comments', {'body': report}), ensure_ascii=False)[:100])
print('1181 patch:', json.dumps(call('/api/issues/' + D1181, {'status': 'done'}, 'PATCH'), ensure_ascii=False)[:200])

push = """## 미push 스택 갱신 — 4건, CI 게이트는 지금 처음으로 전부 초록입니다

[DOW-1133](/DOW/issues/DOW-1133)이 push 결정 창구라 여기 갱신합니다. 새 티켓은 만들지 않았습니다.

### `origin/main..main` 4건

| 커밋 | 성격 | 티켓 |
|---|---|---|
| `640dfc2f` | **운영 런타임** — `components/layout/` 헤더 인증·역할 메뉴 | [DOW-1164](/DOW/issues/DOW-1164) |
| `6dff37fb` | **운영 런타임** — `lib/db.ts`·`db/migrate.ts` SSL 판정 | [DOW-1152](/DOW/issues/DOW-1152) |
| `b26cbce1` | 테스트 단독 | [DOW-1164](/DOW/issues/DOW-1164) |
| `aaf4f164` | 테스트 + `app/page.tsx` 1줄(타이틀을 상수 참조로) | [DOW-1181](/DOW/issues/DOW-1181) |

운영 런타임 포함이라 고정 규칙상 CEO 결정 사항입니다. 5건 한도 아래이지만 **게이트가 초록이 된 지금이 올릴 시점**이라 판단해 올립니다.

### 판단 재료

```
npx tsc --noEmit        # 통과
npx playwright test     # 23 passed / 7 skipped / 0 failed
npx vitest run          # 66 files / 681 passed
```

- **직전까지 e2e가 3건 실패였습니다.** 그 상태로 push했으면 CI 실패 → Fly 배포 중단으로 스택 전체가 막혔습니다. [DOW-1181](/DOW/issues/DOW-1181)에서 2건(09-17 전환 잔여물)을 고치고 [DOW-1164](/DOW/issues/DOW-1164)에서 1건(locator)을 고쳐 지금 0건입니다.
- `app/` 아래 운영 route 변경은 **`app/page.tsx` 1줄뿐**입니다(하드코딩 타이틀 → `lib/site-metadata.ts` 상수). 렌더 결과는 동일합니다. diff를 직접 확인했습니다.
- 헤더 변경(`640dfc2f`)은 QA가 [DOW-1178](/DOW/issues/DOW-1178)에서 375px 네 역할 실측으로 검증했습니다.

### 알고 올리는 한계

- **실계정 로그인 경로는 미검증입니다.** 헤더 검증은 전부 `/api/auth/me` stub 기반 UI 레벨입니다. 세션 쿠키 발급·만료·역할 클레임은 확인하지 않았습니다. 로컬 DB가 없어 지금은 확인할 방법이 없습니다.
- `scripts/check-test-suite-health.mjs`는 빨간불인데, 원인은 **untracked** `__tests__/db/trust-routes-real-db.test.ts`(DATABASE_URL 필요)입니다. 커밋에 포함하지 않았으니 CI에는 올라가지 않습니다. 상세는 [DOW-1181](/DOW/issues/DOW-1181)에 남겼습니다.

### 요청

@Down 위 4건 push 승인 여부를 결정해 주십시오. 승인하시면 제가 집행하고 CI 결과까지 보고합니다. 빨간불이 나면 임의 revert하지 않고 로그와 원인 후보만 남기겠습니다."""

print('1133 comment:', json.dumps(call('/api/issues/' + D1133 + '/comments', {'body': push}), ensure_ascii=False)[:100])
