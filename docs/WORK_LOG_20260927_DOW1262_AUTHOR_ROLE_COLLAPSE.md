# DOW-1262 — 커뮤니티 payload 의 author_role 을 admin/member 로 접음

2026-09-27 (KST). 담당: 입주해 에이전트. CEO 판정: 대안 A, 지금 시행 ([DOW-1261](/DOW/issues/DOW-1261)).

## 무엇을 고쳤나

API 3곳의 `author_role` 식을 같은 표현으로 바꿨다.

```diff
- COALESCE(u.user_type, 'guest') AS author_role
+ CASE WHEN u.user_type = 'admin' THEN 'admin' ELSE 'member' END AS author_role
```

- `app/api/community/posts/route.ts`
- `app/api/community/posts/[id]/route.ts`
- `app/api/community/posts/[id]/comments/route.ts`

타입도 `string` → `'admin' | 'member'` 로 좁혔다. 화면·앱 코드는 건드리지 않았다(전부 `admin` 여부만 본다).

### `guest` 도 함께 사라진다

기존 식은 비로그인 익명 댓글에 `guest` 를 줬다. 이 값을 남기면 **로그인 여부**가 드러난다 — 익명 게시판에서 그것도 신원 범위를 좁히는 값이다. CEO 고정 조건("`admin` 아니면 `member`, 다른 값 도입 금지")과도 일치한다. 소비처는 `guest` 를 쓰지 않는다(`roleLabel('guest')` 는 `null`, 배지는 `admin` 만 렌더).

### 범위 밖으로 둔 것 — `lib/home-content.ts`

같은 `COALESCE(u.user_type, 'guest')` 가 `lib/home-content.ts:87` 에도 있다. 고치지 않았다. 확인한 근거: `getHomeContent()` 의 결과는 `app/page.tsx` 가 **서버에서 직접 렌더**하고(클라이언트 컴포넌트로 넘기는 경로가 없다) 화면에 찍는 것은 `title`·`comment_count` 뿐이다. 즉 `author_role` 이 클라이언트로 나가지 않는다. 티켓의 변경 범위도 API 3곳으로 고정돼 있어 임의로 넓히지 않았다. 홈 데이터를 클라이언트 컴포넌트로 넘기게 바뀌는 날 같이 접어야 한다.

## 판정 — 고정 행 mock 을 쓰지 않았다

`__tests__/api/community-anonymity.test.ts` 의 DB 대역이 **SELECT 식을 읽고** 값을 만든다. `author_role` 도 같은 방식으로 바꿨다.

```ts
const ACCOUNT_ROLE = { post: 'tenant', comment: 'admin' } as const
// 접는 식이 SELECT 에 있을 때만 admin/member 로 좁혀 준다. 없으면 계정 역할 그대로 준다.
```

고정 값을 돌려주면 SQL 을 `COALESCE(u.user_type, 'guest')` 로 되돌려도 payload 판정이 통과해 버린다. 추가한 케이스는 6건이다.

- 목록·상세·댓글 응답 본문에 `"tenant"`·`"landlord"`·`"broker"`·`"guest"` 문자열이 없고 `author_role` 이 `admin|member` 다
- 세 라우트 SQL 이 **같은 표현**을 쓰고 `COALESCE(u.user_type` 이 없다 (하나만 달라지면 그 경로만 역할을 흘린다)

### 대조군 — 패치를 되돌리면 실제로 깨진다

라우트 3파일만 원복하고 같은 테스트를 돌렸다.

```
--- 대조군 (패치 없음) exit 1
 Test Files  1 failed (1)
      Tests  9 failed | 6 passed (15)
--- 재적용 후 exit 0
      Tests  15 passed (15)
```

댓글 payload 케이스 하나는 대조군에서도 통과한다 — 그 fixture 의 댓글 작성자가 운영자라 값이 `admin` 으로 같다. 그 경로는 SQL 단정이 잡았다.

## 게이트

`rtk proxy` 로 돌리고 출력을 직접 읽었다. `npm run typecheck` 가 exit 0 인데 tsc 는 실패한 이력이 있어서 exit code 도 따로 확인했다.

```
node_modules/.bin/tsc --noEmit        → exit 0, 출력 0줄
node_modules/.bin/vitest run          → 84 passed | 1 skipped (85 files)
                                        892 passed | 7 skipped (899 tests)
```

## 로컬 실DB 실측 — 완료 조건 1

배포된 것과 같은 코드를 로컬 실DB 로 띄우고 실제 응답을 받았다 (`scripts/qa/probe_community_anonymity_local.mjs`, DOW-1249 하네스 재사용·확장).

```
목록    author_role 값 집합: ["admin","member"]
상세    [임차인 글] "member"   [운영자 글] "admin"
댓글    [임차인 글] ["member","admin"]   (임차인·임대인·운영자 3명이 쓴 3행)
        [운영자 글] ["member"]
실명 표식 출현: 전 응답 0종
PASS — 금지 키 없음, 계정 실명 표식 없음, author_role 은 admin/member 뿐, 댓글 행 존재
```

`tenant`·`landlord` **0건**이다. 임대인이 쓴 댓글이 `member` 로 나오는 것까지 실제 행으로 확인했다.

프로브를 확장하면서 거짓 FAIL 하나를 미리 막았다: `audience` 는 **게시판 라벨**이라 임차인 게시판 글은 `audience: "tenant"` 를 정상적으로 갖는다. 본문 문자열 스캔에서 이 필드를 빼지 않으면 정상 응답이 FAIL 로 찍힌다.

### 화면 회귀 확인

`scripts/qa/probe_community_display_local.mjs` 재실행 — 임차인 글 이름 노드 `익명`, 운영자 글 `입주해` + 배지 `운영자` 1회. `member` 로 바뀌어도 표시는 그대로다(`authorDisplayName` 이 `admin` 만 분기).

## push

**하지 않았다.** 운영 런타임 변경이라 CEO 판정을 받는다. 판정 요청 이슈를 올렸다.
