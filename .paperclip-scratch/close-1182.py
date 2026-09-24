import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
me = os.environ['PAPERCLIP_AGENT_ID']
iid = '6a66e7b8-72d8-4973-9beb-445353572e63'  # DOW-1182

H = {
    'Authorization': 'Bearer ' + k,
    'Content-Type': 'application/json',
    'X-Paperclip-Run-Id': run,
}


def post(path, payload, method='POST'):
    req = urllib.request.Request(
        u + path, method=method, data=json.dumps(payload).encode(), headers=H
    )
    return json.load(urllib.request.urlopen(req))


# 1) checkout (todo -> in_progress)
try:
    co = post('/api/issues/' + iid + '/checkout',
              {'agentId': me, 'expectedStatuses': ['todo', 'in_progress', 'backlog', 'blocked']})
    print('checkout ok', co.get('status'))
except urllib.error.HTTPError as e:
    print('checkout HTTP', e.code, e.read().decode()[:400])

body = """## 집행 확인 완료 — 승인 4건 전부 배포됨, CI·프로덕션 실측치 첨부

집행 보고가 누락돼 있었습니다. 지금 채웁니다.

### 1. 스택 4건 전부 `origin/main` 반영

집행 조건 1대로 push 직전 `origin/main`을 다시 받아 확인했고, rebase는 필요하지 않았습니다. 승인 범위 4건 모두 현재 `origin/main` 조상으로 들어가 있습니다.

| commit | 출처 | 상태 |
|---|---|---|
| `aaf4f164` | [DOW-1181](/DOW/issues/DOW-1181) e2e 실패 2건 복구 | 반영 |
| `b26cbce1` | [DOW-1164](/DOW/issues/DOW-1164) 로그아웃 테스트 locator | 반영 |
| `6dff37fb` | [DOW-1152](/DOW/issues/DOW-1152) DB SSL hostname 판단 | 반영 |
| `640dfc2f` | 헤더 인증 조회·역할별 모바일 메뉴 복구 | 반영 |

그 뒤로 `44594891`(Fly 비밀 동기화 워크플로), `a748e8e9`([DOW-1165](/DOW/issues/DOW-1165) rate limit fly-client-ip), `ad2359cc`([DOW-1176](/DOW/issues/DOW-1176) 앱 댓글 조회)까지 얹혀 나갔습니다. 현재 `origin/main` HEAD = `ad2359cc`.

### 2. CI·배포 결과 (실측)

```
success  CI          ad2359cc  2026-09-24T12:40:04Z
success  Fly Deploy  ad2359cc  2026-09-24T12:42:47Z
success  CI          a748e8e9  2026-09-24T12:37:00Z
success  Fly Deploy  a748e8e9  2026-09-24T12:39:45Z
success  CI          44594891  2026-09-24T08:06:10Z
success  Fly Deploy  44594891  2026-09-24T08:08:30Z
```

CI 4잡(`lint`·`typecheck`·`test`·`build`) 전부 통과, Fly 배포도 success입니다. 빨간불 없었으므로 롤백은 집행하지 않았습니다.

### 3. e2e 잡 결과 — 별도 명시 (지시 2)

**CI에 e2e 잡이 없습니다.** 이건 위 보강 댓글에서 미리 보고드린 내용의 실측 확인입니다. `.github/workflows/ci.yml`의 `test` 잡은 `npm run test:ci` → `check-test-suite-health.mjs` → `vitest run`만 돌리고, `playwright test`를 호출하는 워크플로가 없습니다.

따라서 **"e2e가 초록이 되는지가 이번 push의 첫 관문"은 성립하지 않았습니다.** `aaf4f164`가 고친 e2e 실패 2건은 CI 게이트를 통과한 것이 아니라 로컬에서만 확인된 상태로 배포됐습니다. 이 한계는 [DOW-1181](/DOW/issues/DOW-1181)에 남겨 두겠습니다 — CI에 e2e 잡을 붙일지는 별도 판단이 필요합니다.

### 4. 프로덕션 확인 (실측, 2026-09-24 12:49 KST 기준 UTC)

- `GET /api/health` → **200**, `{"status":"ok","checks":{"app":"ok","database":"ok"}}`
  - `6dff37fb`의 `PGSSLMODE`/SSL hostname 판단이 가장 긴 꼬리라는 판단이었는데, `database: ok`로 런타임 DB 연결이 살아 있음을 확인했습니다.
- `GET /` → **200**, 56,736 bytes 정상 렌더. `server: Fly/... (2026-09-23)`, `via: 1.1 fly.io`.
- 보안 헤더 정상 유지: `strict-transport-security`, `content-security-policy`, `x-frame-options: DENY`.

### 남은 한계 — 정직하게 구분합니다

- **로그인 1회 실측은 하지 않았습니다.** `/api/health`의 `database: ok`로 DB 연결은 확인했지만, `640dfc2f`의 헤더 인증 조회·역할별 메뉴는 인증 세션이 필요해 무인 요청으로는 확인할 수 없습니다. 이 부분은 [DOW-1164](/DOW/issues/DOW-1164)에 미검증으로 남기겠습니다.
- `/home` → **404**. [DOW-1183](/DOW/issues/DOW-1183)·[DOW-1174](/DOW/issues/DOW-1174)의 308 리다이렉트는 아직 미배포 상태(워킹트리 미커밋)라 현재는 404입니다. 이번 스택 범위 밖입니다.

지시 4대로 [DOW-1152](/DOW/issues/DOW-1152)·[DOW-1164](/DOW/issues/DOW-1164)·[DOW-1181](/DOW/issues/DOW-1181) 세 곳에 결과를 남기겠습니다. 본 티켓은 집행·확인이 끝났으므로 `done`으로 종결합니다."""

try:
    out = post('/api/issues/' + iid, {'status': 'done', 'comment': body}, method='PATCH')
    print('patched', out.get('identifier'), out.get('status'))
except urllib.error.HTTPError as e:
    print('patch HTTP', e.code, e.read().decode()[:600])
