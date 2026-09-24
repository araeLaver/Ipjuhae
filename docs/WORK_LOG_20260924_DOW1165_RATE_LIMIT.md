# 2026-09-24 — DOW-1165 익명 댓글 rate limit 점검

담당: 입주해 / 런 `dc3194a8`

## 한 줄

티켓이 지목한 "import만 하고 미호출"은 이미 [DOW-1158]에서 고쳐져 배포돼 있었다. 대신 **한도 자체가 위조 가능한 값으로 세어지고 있던 것**을 찾아 막았다.

## 1. 티켓 항목 1 — 이미 해소돼 있었다

`app/api/community/posts/[id]/comments/route.ts:68`이 `rateLimit`을 실제로 호출한다(10분 15회, 비로그인만). 커밋 `62ecffd5`([DOW-1158])에서 들어갔고 `origin/main`에 포함돼 있다. 재현 테스트도 `__tests__/api/community-comment-rate-limit.test.ts`로 이미 있었다 — 소스 grep이 아니라 **같은 IP로 16번 밀어넣어 429가 나오는 지점**을 본다.

## 2. 티켓 항목 2 — 조용히 실패하지 않는다

`components/community/community-post-view.tsx:120`이 서버 `error` 문구를 그대로 `toast.error`로 띄운다. 429 문구는 `잠시 후 다시 시도해주세요. 짧은 시간에 너무 많이 올렸습니다.`이고, 실패 시 `setBody('')`를 하지 않아 **쓴 내용이 보존된다.**

문구가 비면 `'댓글 작성 실패'`로 뭉개져 왜 막혔는지 알 수 없게 되므로, 그 문구를 고정하는 테스트를 추가했다.

## 3. 티켓 항목 3 — 미호출 limiter는 없다

이름으로 grep하면 import 줄 자체에 걸려 언제나 "있음"이 된다. 그래서 **import 줄을 지운 본문에서 호출 횟수를 센다**(`.paperclip-scratch/limiter_sweep.mjs`).

```
rate-limit 모듈 import 파일 14개 / import 심볼 20개
미호출 limiter: 0

ok  authRateLimit  1회  app/api/auth/login/route.ts
ok  authRateLimit  1회  app/api/auth/signup/route.ts
ok  rateLimit      1회  app/api/community/posts/[id]/comments/route.ts
ok  rateLimit      1회  app/api/community/posts/route.ts
ok  rateLimit      1회  app/api/community/reports/route.ts
ok  apiRateLimit   3회  app/api/references/verify/[token]/route.ts
```

`getClientIp`만 import하는 파일 8개는 해싱·로깅 용도이며 전부 호출된다(미사용 심볼 0개).

## 4. 실제로 남아 있던 구멍 — 한도 키를 클라이언트가 고를 수 있었다

`lib/rate-limit.ts`의 `getClientIp`와 `middleware.ts`의 `getIp`가 **`x-forwarded-for` 맨 앞 값**을 IP로 썼다.

Fly 문서([request-headers](https://fly.io/docs/networking/request-headers/))가 명시한다 — 이 헤더는 "위조 시도에 주의해 다뤄야" 하고, 클라이언트가 실어 보내면 Fly Proxy는 **거기에 덧붙이기만** 한다. 따라서 공격자가 `x-forwarded-for: 1.2.3.4`를 보내면 앱이 보는 맨 앞 값이 그 문자열이다.

**요청마다 값을 바꾸면 rate limit 키가 매번 달라져 한도가 사실상 사라진다.** 호출은 되는데 안 걸리는, 이 티켓이 지적한 것과 같은 종류의 결함이다. 영향 범위는 댓글만이 아니라 **IP로 세는 모든 한도**다 — 로그인·회원가입(`authRateLimit`), 글 작성, 신고, 레퍼런스 검증, middleware 한도 전부. 익명 댓글의 `author_hash`도 이 값으로 만들어져 작성자 추적이 흐려진다.

### 고친 방법

`fly-client-ip`를 먼저 본다. Fly Proxy가 직접 채우고 클라이언트가 보낸 값은 덮어써지므로 위조할 수 없다.

운영이 Fly 앞단에 다른 프록시를 두고 있지 않은 것을 응답 헤더로 확인했다 — `server: Fly/67a399e710`, `via: 1.1 fly.io`, `cf-ray` 없음. 즉 이 값이 곧 클라이언트 IP다.

`x-forwarded-for` → `x-real-ip` 폴백 **순서는 건드리지 않았다.** `fly-client-ip`가 없는 로컬·테스트 환경만 그 경로를 타므로 기존 테스트와 개발 동작이 그대로다. 변경은 "위조 불가능한 값이 있으면 그걸 쓴다" 한 가지뿐이다.

middleware는 같은 로직을 복제했다. Edge 런타임이라 모듈을 잘못 끌어오면 전면 장애가 된 전례가 있어(`jsonwebtoken`) 헤더 한 줄 읽는 코드의 중복을 감수했다.

### 되돌려 실패 확인

새 테스트 3건이 수정을 빼면 전부 실패하는 것을 확인했다 — 통과가 우연이 아니다.

```
fix 제거 후:  3 failed | 15 passed
fix 복원 후:  18 passed
```

## 알고 남기는 한계

- **한도 저장소가 인메모리 Map이다**(`lib/rate-limit.ts:10`). 지금은 `fly.toml`이 단일 머신(`min_machines_running = 1`, 2026-08-29 scale count 1)이라 문제되지 않지만, **스케일아웃하면 인스턴스마다 카운터가 따로 생겨 실효 한도가 대수만큼 늘어난다.** 파일 첫 주석도 "프로덕션에서는 Redis 기반으로 교체 권장"이라 적혀 있다. Socket.IO 때문에 스케일아웃 전 Redis가 선행 조건이라 같은 시점에 함께 처리되는 게 맞다 — 지금 고치지 않았다.
- **앞에 Cloudflare를 두게 되면 `fly-client-ip`가 그 프록시 IP로 바뀐다.** 전원이 한 키를 공유해 오히려 과차단이 된다. 코드 주석에 이 조건을 적어 뒀다.

## 게이트

```
npx vitest run     66 files / 685 passed   (직전 681, 신규 4건)
npx tsc --noEmit   통과
npx eslint         변경 4파일 클린
```

[DOW-1158]: /DOW/issues/DOW-1158
