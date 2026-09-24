# DOW-1158 — 커뮤니티 글 상세 결함 4건 + 익명 댓글 rate limit

- 날짜: 2026-09-24
- 담당: 빌더
- 커밋: `62ecffd5` (origin/main 반영 확인)
- 출처: DOW-1137 UX 검수 D3·D4·D5·U1·U2

## 고친 것

### D3 — 403에서 나갈 길이 없었다

`community-post-view.tsx:44`가 `res.status === 401`을 분기했는데 **이 API는 401을 반환하지 않는다.** 역할 판 글은 `app/api/community/posts/[id]/route.ts:43-44`에서 403이다. 한 번도 타지 않는 코드라 지웠다. 그 안의 주소 `` `/login?redirect=//${id}` `` 도 틀렸다 — `//<id>`는 경로가 아니라 프로토콜 상대 URL(호스트)이다.

403을 두 경우로 나눴다. `/api/auth/me`(목록 화면과 같은 경로)로 보는 사람을 먼저 확인한다.

- 비로그인 → `/login?redirect=/community/<id>` 링크
- 로그인했는데 역할이 다름 → 로그인 버튼 대신 커뮤니티로 돌아가기

역할이 안 맞는 사람에게 로그인 버튼을 세우면 그게 또 막다른 길이다.

**범위 밖 1파일:** 로그인 페이지가 `redirect` 파라미터를 아예 읽지 않고 `user_type`으로만 보내고 있었다(`app/login/page.tsx:132-139`). 링크만 고치면 빈 약속이 된다. 비밀번호 로그인 경로에 복귀를 붙였고 같은 사이트 절대경로만 받는다(`//host` 제외). **매직 링크(`/auth/callback` 경유)는 배선하지 않았다 — 남은 구멍.**

### D4 — 댓글 조회 실패가 "댓글 0"으로 보였다

`if (cRes.ok)`만 처리해서 실패 시 빈 배열이 남았다. 실패 상태를 따로 들고 다시 시도 버튼을 세운다.

**개수는 `comment_count`를 쓰지 않기로 했다.** 이 값은 작성 때만 `+1` 되고(`comments/route.ts:91`이 유일한 갱신) 삭제·숨김에서 줄지 않는다. 숨겨진 댓글이 있으면 머리글이 바로 아래 목록과 어긋난다. 성공하면 `comments.length`, 실패하면 숫자를 내지 않는다.

목록 화면은 여전히 `comment_count`를 쓰므로 두 화면 숫자가 어긋날 수 있다 → DOW-1163.

### U1 — 운영자 답을 구분할 수 없었다

서버는 `author_role`·`is_author`를 이미 내려주는데(`posts/[id]/route.ts:33,50`, `comments/route.ts:41`) UI가 버렸다.

- 글·댓글에 역할 배지. 표기가 두 화면에서 갈리지 않게 `components/community/author-role-badge.tsx`로 뽑았고 클래스는 목록 화면 인라인 마크업과 글자 단위로 동일(운영자만 `bg-primary`).
- 목록 화면은 전환하지 않았다 — DOW-1136이 같은 파일 수정 중이었다(작업 중 `3da23b9f`로 머지).
- `is_author`: **수정·삭제 API가 아예 없다**(`posts/[id]/route.ts`에 `GET`만). UI로 되는 데까지만 — `내 글` 표시 + 자기 글 신고 버튼 제거 → 서버 건은 DOW-1163.

### D5 — 익명 댓글 rate limit

`rateLimit`을 import만 하고 호출하지 않았다. 글 작성·신고와 같은 방식으로 `if (!user)` 안에서 적용, 초과 시 429.

**한도 10분 15회.** 한 글타래에서 주고받는 게 정상이라 글 작성(10분 5회)보다 느슨해야 하지만 무제한은 도배 경로다. 40초에 한 번꼴.

### U2 — 신고 UI

DOW-1136이 확정한 패턴(sonner `toast`)을 그대로. `window.prompt` 1곳 + `alert` 3곳 제거, 사유 입력은 화면 안 패널(사유 버튼 4개 + textarea).

### 곁다리 — React 19 API 의존

페이지가 `params` Promise를 넘기고 클라이언트가 `React.use()`로 풀고 있었다. **`use()`는 React 19 API인데 이 저장소 react는 18.3**이라 화면을 단독 렌더할 수 없었다(테스트가 이걸로 먼저 깨졌다). `app/community/[id]/page.tsx`에서 서버가 `await`해 `id`를 넘기도록 바꿨다.

## 검증

- 새 회귀 테스트 13건: UI 9 (`__tests__/components/community-post-view.test.tsx`) + API 4 (`__tests__/api/community-comment-rate-limit.test.ts`). 소스 grep이 아니라 실제 렌더/실제 요청으로 판정.
- **대조군:** 수정을 되돌려 실제로 깨지는지 확인 — rate limit 제거 시 2건 실패, 실패 삼킴 복원 시 "댓글 0" 1건 실패.
- 전체 `65 files / 648 tests` 통과, `tsc --noEmit` 통과, `eslint` 통과.
- **`next build`는 로컬에서 실패하지만 이번 변경과 무관.** 내 변경을 stash하고 같은 빌드를 돌렸더니 기준선도 실패(`/profile/edit`, `Cannot read properties of null (reading 'useContext')`). 변경 있을 때는 `/500`이었고 실행마다 페이지가 바뀐다 — 로컬 프리렌더 환경 문제로 보인다. CI의 `npm run build` 결과 확인 필요.

## 넘긴 것

- **DOW-1163** — 본인 글·댓글 수정/삭제 API 부재 + `comment_count` 정합성 + 목록 화면 배지 컴포넌트 전환 (DOW-1137 하위 backlog)
