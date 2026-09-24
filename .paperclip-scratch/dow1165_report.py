import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
CEO = 'f6b770fa-e6aa-49b4-8e02-82a63a57e3b8'
D1165 = 'bd18b762-89b1-4490-814f-c5acd989dc66'
D1133 = '083b6c6c-152a-4fbc-8960-8255d656a9b2'


def call(path, body, method='POST'):
    r = urllib.request.Request(
        u + path, data=json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json',
                 'X-Paperclip-Run-Id': run},
        method=method,
    )
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'ERR': e.code, 'body': e.read().decode()[:300]}


body = """## 세 항목 다 확인했습니다. 그런데 **진짜 구멍은 다른 곳**이었습니다

커밋 `a748e8e9`. 워크로그: `docs/WORK_LOG_20260924_DOW1165_RATE_LIMIT.md`

### 항목 1 — 이미 고쳐져 배포돼 있었습니다

`app/api/community/posts/[id]/comments/route.ts:68`이 `rateLimit`을 실제로 호출합니다(비로그인만, 10분 15회). 커밋 `62ecffd5`([DOW-1158](/DOW/issues/DOW-1158))에서 들어갔고 **`origin/main`에 포함**된 것을 확인했습니다. 재현 테스트도 이미 있었습니다 — 소스 grep이 아니라 같은 IP로 16번 밀어넣어 429가 나오는 지점을 봅니다.

즉 검수 시점의 D5 지적은 맞았고, 그 사이 다른 티켓이 같이 가져갔습니다. **이 티켓만 보면 "끝났다"로 닫힐 자리였습니다.**

### 항목 2 — 조용히 실패하지 않습니다

`components/community/community-post-view.tsx:120`이 서버 `error` 문구를 그대로 `toast.error`로 띄웁니다.

- 문구: `잠시 후 다시 시도해주세요. 짧은 시간에 너무 많이 올렸습니다.`
- 실패 시 `setBody('')`를 하지 않아 **쓴 내용이 남습니다.** 막혔다고 글이 날아가지 않습니다.

문구가 비면 `'댓글 작성 실패'`로 뭉개져 왜 막혔는지 알 수 없게 되므로, 그 문구를 고정하는 테스트를 추가했습니다.

### 항목 3 — 미호출 limiter는 없습니다

이름으로 grep하면 **import 줄 자체에 걸려 언제나 "있음"** 이 됩니다. 그래서 import 줄을 지운 본문에서 호출 횟수를 셌습니다.

```
rate-limit 모듈 import 파일 14개 / import 심볼 20개
미호출 limiter: 0건

ok  authRateLimit  1회  app/api/auth/login/route.ts
ok  authRateLimit  1회  app/api/auth/signup/route.ts
ok  rateLimit      1회  app/api/community/posts/[id]/comments/route.ts
ok  rateLimit      1회  app/api/community/posts/route.ts
ok  rateLimit      1회  app/api/community/reports/route.ts
ok  apiRateLimit   3회  app/api/references/verify/[token]/route.ts
```

`getClientIp`만 import하는 파일 8개는 해싱·로깅 용도이고 전부 호출됩니다. 미사용 심볼 0개입니다.

---

## 실제로 열려 있던 구멍 — 한도 키를 공격자가 고를 수 있었습니다

`lib/rate-limit.ts`의 `getClientIp`와 `middleware.ts`의 `getIp`가 **`x-forwarded-for` 맨 앞 값**을 IP로 썼습니다.

Fly 문서가 못박습니다 — 이 헤더는 "위조 시도에 주의해 다뤄야" 하고, 클라이언트가 실어 보내면 Fly Proxy는 **거기에 덧붙이기만** 합니다. 그래서 공격자가 `x-forwarded-for: 1.2.3.4`를 보내면 앱이 보는 맨 앞 값이 그 문자열이 됩니다.

**요청마다 값을 바꾸면 한도 키가 매번 달라져 제한이 사실상 사라집니다.** 호출은 되는데 안 걸리는 상태 — 이 티켓이 지적한 것과 **정확히 같은 종류의 결함**이고, 한 단계 아래에 있었습니다.

영향 범위가 댓글만이 아닙니다. **IP로 세는 모든 한도**입니다.

| 경로 | 한도 |
|---|---|
| 로그인·회원가입 | 분당 10회 |
| 익명 댓글 | 10분 15회 |
| 글 작성 | 10분 5회 |
| 신고 | 1시간 20회 |
| 레퍼런스 검증 | 분당 60회 |
| middleware 전역 | 분당 10/60회 |

익명 댓글의 `author_hash`도 이 값으로 만들어지므로 **작성자 추적도 흐려집니다.** 도배한 사람을 나중에 묶어 보려 해도 해시가 요청마다 달라집니다.

### 고친 방법

`fly-client-ip`를 먼저 봅니다. Fly Proxy가 직접 채우고 클라이언트가 보낸 값은 덮어써지므로 위조할 수 없습니다.

운영이 Fly 앞단에 다른 프록시를 두고 있지 않은 것을 **응답 헤더로 직접 확인**했습니다 — `server: Fly/67a399e710`, `via: 1.1 fly.io`, `cf-ray` 없음.

`x-forwarded-for` → `x-real-ip` 폴백 **순서는 건드리지 않았습니다.** `fly-client-ip`가 없는 로컬·테스트만 그 경로를 타므로 기존 테스트와 개발 동작이 그대로입니다. 변경은 "위조 불가능한 값이 있으면 그걸 쓴다" 한 가지입니다.

middleware는 lib을 import하지 않고 같은 로직을 뒀습니다. Edge 런타임에 모듈을 잘못 끌어와 전면 장애가 난 전례(`jsonwebtoken`)가 있어 헤더 한 줄 읽는 코드의 중복을 감수했습니다.

### 통과가 우연이 아닌 것을 확인했습니다

새 테스트 3건이 **수정을 빼면 전부 실패**합니다.

```
fix 제거:  3 failed | 15 passed
fix 복원:  18 passed
```

### 게이트

```
npx vitest run     66 files / 685 passed   (직전 681, 신규 4건)
npx tsc --noEmit   통과
npx eslint         변경 4파일 클린
```

## 알고 남기는 한계 2가지

- **한도 저장소가 인메모리 Map입니다**(`lib/rate-limit.ts:10`, 파일 첫 주석도 "프로덕션에서는 Redis 권장"). 지금은 `fly.toml`이 단일 머신이라 문제되지 않지만 **스케일아웃하면 인스턴스마다 카운터가 따로 생겨 실효 한도가 대수만큼 늘어납니다.** Socket.IO 때문에 스케일아웃 전 Redis가 이미 선행 조건이라 같은 시점에 함께 가는 게 맞다고 보고 지금 손대지 않았습니다.
- **앞에 Cloudflare를 두게 되면 `fly-client-ip`가 그 프록시 IP로 바뀝니다.** 전원이 한 키를 공유해 오히려 과차단이 됩니다. 코드 주석에 이 조건을 적어 뒀습니다.

## @Down 결정 요청 — 그래서 done으로 닫지 않았습니다

이 수정은 **`origin/main`에 없습니다.** 외부에서 악용 가능한 구멍을 막은 커밋이 로컬에만 있으면 막은 게 아니라 판단해 `in_review`로 두고 넘깁니다.

미push 스택이 **6건**이 됐습니다 — 고정 규칙상 5건 초과는 내용과 무관하게 결정 요청 대상입니다. 현황과 판단 재료는 [DOW-1133](/DOW/issues/DOW-1133)에 갱신했습니다. 승인하시면 제가 집행하고 CI 결과까지 보고합니다."""

print('1165:', json.dumps(call('/api/issues/' + D1165, {'status': 'in_review', 'assigneeAgentId': CEO, 'comment': body}, 'PATCH'), ensure_ascii=False)[:120])

stack = """## 미push 스택 6건 — 5건 초과라 규칙대로 올립니다. **보안 수정 1건 포함**

앞선 갱신(4건) 이후 2건이 늘었습니다. 고정 규칙상 5건 초과는 내용과 무관하게 결정 요청 대상입니다.

| 커밋 | 성격 | 티켓 |
|---|---|---|
| `a748e8e9` | **운영 런타임 · 보안** — `lib/rate-limit.ts`·`middleware.ts` 한도 키 위조 차단 | [DOW-1165](/DOW/issues/DOW-1165) |
| `640dfc2f` | 운영 런타임 — 헤더 인증·역할 메뉴 | [DOW-1164](/DOW/issues/DOW-1164) |
| `6dff37fb` | 운영 런타임 — DB SSL 판정 | [DOW-1152](/DOW/issues/DOW-1152) |
| `b26cbce1` | 테스트 단독 | [DOW-1164](/DOW/issues/DOW-1164) |
| `aaf4f164` | 테스트 + `app/page.tsx` 1줄 | [DOW-1181](/DOW/issues/DOW-1181) |
| `29094829` | 문서 단독 | — |

### 우선순위를 다시 봐 주셔야 할 이유

`a748e8e9`는 단순 개선이 아닙니다. **IP로 세는 모든 한도가 헤더 한 줄로 우회 가능한 상태**였습니다 — 로그인·회원가입·익명 댓글·글 작성·신고·레퍼런스 검증·middleware 전역. 익명 댓글 작성자 해시도 같은 값으로 만들어져 추적이 흐려집니다.

**지금 운영에 열려 있습니다.** 근거와 수정 내용은 [DOW-1165](/DOW/issues/DOW-1165)에 정리했습니다.

### 판단 재료

```
npx tsc --noEmit        통과
npx playwright test     23 passed / 7 skipped / 0 failed
npx vitest run          66 files / 685 passed
```

- `app/` 아래 운영 route 변경은 **`app/page.tsx` 1줄뿐**입니다(하드코딩 타이틀 → 상수 참조, 렌더 결과 동일). diff를 직접 확인했습니다.
- 나머지 런타임 변경은 `lib/rate-limit.ts`, `middleware.ts`, `lib/db.ts`, `db/migrate.ts`, `components/layout/*`입니다.
- **직전까지 e2e 3건이 실패였습니다.** 그 상태로 올렸으면 CI 실패 → 배포 중단으로 스택 전체가 막혔습니다. 지금 처음으로 게이트가 전부 초록입니다.
- `scripts/check-test-suite-health.mjs`만 빨간불인데, 원인은 **untracked** `__tests__/db/trust-routes-real-db.test.ts`(DATABASE_URL 필요)입니다. 커밋에 없으니 CI에는 올라가지 않습니다.

### 요청

@Down 6건 push 승인 여부를 결정해 주십시오. 승인하시면 제가 집행하고 CI 결과까지 보고합니다. 빨간불이 나면 임의 revert 없이 로그와 원인 후보만 남기겠습니다."""

print('1133:', json.dumps(call('/api/issues/' + D1133 + '/comments', {'body': stack}), ensure_ascii=False)[:100])
