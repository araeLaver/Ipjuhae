# DOW-1168 — 403 화면 로그인 복구 경로 + 중복 슬래시 (2026-09-25)

커밋: `412abaf8` (작성 시점 미push, 결정 요청 DOW-1192)

## 들어가기 전 상태

DOW-1137 UX 검수 계획서의 D3 두 가지였다.

1. 403 화면에 로그인 복구 경로가 없다
2. `/login?redirect=//${id}` — `//`는 프로토콜 상대 URL이라 외부 호스트로 읽힌다

착수해 보니 **화면 쪽은 이미 고쳐져 있었다.** `components/community/community-post-view.tsx`에서 사문화된 401 분기는 제거됐고, 403이면 비로그인 사용자에게 로그인 버튼이, 역할 불일치 사용자에게는 커뮤니티 복귀 버튼이 나온다. `//${id}`도 `/community/${id}`로 바뀌어 있었다.

## 실제로 남아 있던 결함

버튼을 눌러 도착한 **로그인 화면이 목적지를 지키지 못했다.** 로그인 수단 세 가지 중 하나만 `?redirect=`를 읽고 있었다.

- 비밀번호 — 복귀 동작 (이것만 됐다)
- 매직 링크 — `emailRedirectTo`가 `/auth/callback` 고정, 목적지를 싣지 않음
- 소셜 — OAuth 왕복 중 쿼리가 사라지고 콜백이 무조건 `/profile`

403 화면에서 "로그인하고 이어서 보기"를 누른 사람이 카카오를 고르면 원래 글로 못 돌아왔다. 완료 기준이 "실제로 동작"이라 여기를 닫아야 기준을 만족한다.

## 수정

- **`lib/safe-redirect.ts` 신설** — 복귀 경로 판정을 한 곳에만. `//host`, `/\host`, 스킴이 붙은 외부 주소, 개행·제어문자 거부. 진입점이 네 군데라 각자 구현하면 한 곳만 느슨해진다.
- **매직 링크** — `emailRedirectTo`에 `?redirect=`를 실어 보내고 `app/auth/callback/route.ts`가 읽는다. 메일을 열 때는 원래 페이지 쿼리가 남아 있지 않아 여기서 넘기지 않으면 값이 사라진다.
- **소셜** — 시작 시 `oauth_redirect` 쿠키에 담아 `state`와 같은 수명(5분)으로 왕복. 콜백에서 쿠키 값도 다시 검증한다. 값이 없으면 종전과 완전히 같은 동작.
- **`middleware.ts`** — 곁다리로 같이 고쳤다. `request.nextUrl.clone()`이 원래 페이지 쿼리를 `/login` 자체 파라미터로 흘려서, `/profile?error=oauth_denied`로 막히면 일어나지도 않은 소셜 로그인 실패 토스트가 떴다. 주소를 새로 만들고 원래 쿼리는 `redirect` 값 안에 담는다.

신규 가입은 종전대로 온보딩으로 보낸다. 복귀는 기존 사용자 로그인에만 적용.

## 중복 슬래시 전수 점검

- `` `//${...}` `` 형태 **0건**. 남아 있지 않다.
- `${basePath}/${id}` 두 곳(`conversation-list.tsx:86`, `start-conversation-button.tsx:47`)은 호출부가 전부 끝 슬래시 없는 값이라 안전.
- `/login?redirect=` 생성 네 곳 정상.

**다만 같은 부류의 잠복 위험**: `NEXT_PUBLIC_BASE_URL`을 `${base}/login` 꼴로 접합하는 곳이 13군데. 현재 설정값(`https://www.ipjuhae.com`)에 끝 슬래시가 없어 지금은 결함이 아니지만, 끝 슬래시가 붙는 순간 13곳이 동시에 `//`가 되고 `lib/oauth.ts:53`은 OAuth `redirect_uri`라 소셜 로그인 전체가 죽는다. 범위 밖이라 DOW-1193으로 분리했다.

## 검증

- `npx tsc --noEmit` 통과
- `npx vitest run` — 748 passed / 0 failed / 7 skipped (76 파일). 기준선 708 + 회귀 방어 3종.
- `node scripts/check-test-suite-health.mjs` — 755개 / 죽은 스위트 0 (하한 606)
- **대조군**: 수정을 되돌린 상태로 돌려 소셜 콜백 1건·미들웨어 2건이 실제로 실패하는 것까지 확인했다. 되돌려도 초록이면 감시가 허구다([[source-grep-boundary-tests-false-assurance]]와 같은 함정).
- 라이브 확인은 못 했다. 로컬 dev 서버 기동이 셸 권한에서 막혔고 3000 포트는 다른 앱이 점유 중이다. 실물 확인은 배포 후 QA 몫.

## 남은 것

- DOW-1192 — push 결정(운영 런타임 포함, CEO)
- DOW-1193 — base URL 접합 13곳 정규화
- 배포 후 QA 실물 확인 → DOW-1168 종결
