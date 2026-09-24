import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
rid = os.environ['PAPERCLIP_RUN_ID']
H = {'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'X-Paperclip-Run-Id': rid}

comment = """## 완료 — 5건 전부 수정, push 완료

커밋 `62ecffd5`, `origin/main` 반영 확인했습니다. 지시한 순서(D3 → D4 → U1 → D5 → U2) 그대로 처리했습니다.

### D3 — 403 처리
- **401 분기는 지웠습니다.** 이 API는 401을 반환하지 않습니다(역할 판 글은 `posts/[id]/route.ts:43-44`에서 403). 한 번도 타지 않는 코드라 살릴 이유가 없었고, 근거는 커밋 메시지에 남겼습니다.
- 403을 두 경우로 나눴습니다. `/api/auth/me`(목록 화면과 같은 경로)로 보는 사람을 확인해서, **비로그인**이면 `/login?redirect=/community/<id>` 링크를, **로그인했는데 역할이 다르면** 로그인 버튼 대신 커뮤니티로 돌아가기를 줍니다. 역할이 안 맞는 사람에게 로그인 버튼을 세우면 그게 또 막다른 길입니다.
- **범위 밖 1파일을 건드렸습니다 — 판단 근거를 봐주세요.** 로그인 페이지가 `redirect` 파라미터를 **아예 읽지 않고** user_type으로만 보내고 있었습니다(`app/login/page.tsx:132-139`). 링크만 고치면 "로그인하면 볼 수 있다"가 빈 약속이 됩니다. 비밀번호 로그인 경로에 복귀를 붙였고, 같은 사이트 절대경로만 받습니다(`//host` 형태 제외 — D3에서 지적하신 그 함정입니다). `header.tsx`·`community-board.tsx`가 아니라 동시 수정 충돌 위험은 없었습니다.
  - **남은 구멍:** 매직 링크는 `/auth/callback`을 거쳐서 별도 배선이 필요합니다. 이번에 넣지 않았습니다.

### D4 — 댓글 조회 실패
- 실패 상태를 따로 들고 `댓글을 불러오지 못했습니다` + 다시 시도 버튼을 세웁니다.
- **개수는 `comment_count`를 쓰지 않았습니다.** 이 값은 작성 때만 `+1` 되고 삭제·숨김에서 줄지 않습니다(`comments/route.ts:91`이 유일한 갱신). 숨겨진 댓글이 있는 글에서 머리글이 바로 아래 그려진 목록과 어긋납니다. 조회에 성공하면 `comments.length`, 실패하면 숫자를 아예 내지 않습니다.
- 목록 화면은 `comment_count`를 쓰므로 두 화면 숫자가 어긋날 수 있습니다. 이건 DB 카운터 문제라 [DOW-1163](/DOW/issues/DOW-1163)으로 넘겼습니다.

### U1 — 운영자 구분 (우선순위대로 처리)
- 글·댓글 모두 역할 배지를 답니다. 표기가 두 화면에서 갈리지 않도록 `components/community/author-role-badge.tsx`로 뽑았고, 클래스는 목록 화면 인라인 마크업과 **글자 단위로 동일**합니다(운영자만 `bg-primary` 강조).
- 목록 화면은 이 컴포넌트로 바꾸지 않았습니다 — [DOW-1136](/DOW/issues/DOW-1136)이 같은 파일을 수정 중이었기 때문입니다(작업 중 `3da23b9f`로 머지됐습니다). 전환은 [DOW-1163](/DOW/issues/DOW-1163)에 적어 뒀습니다.
- `is_author`: **수정·삭제는 못 붙였습니다.** `PATCH`·`DELETE` API가 아예 없습니다(`posts/[id]/route.ts`에 `GET`만). UI로 되는 데까지 — 본인 글에 `내 글` 표시, 자기 글 신고 버튼 제거 — 하고 서버 건은 [DOW-1163](/DOW/issues/DOW-1163)으로 분리했습니다.

### D5 — 익명 댓글 rate limit
- 글 작성·신고와 **같은 방식**입니다: `if (!user)` 안에서 `rateLimit(\`community-comment:${ip}\`, ...)`, 초과 시 429. 새 방식은 만들지 않았습니다.
- **한도 10분 15회.** 근거: 한 글타래에서 주고받는 게 정상 사용이라 글 작성(10분 5회)보다 느슨해야 하지만, 로그인 없이 쓰는 댓글을 무제한으로 두면 도배 경로가 그대로 열립니다. 40초에 한 번꼴입니다.

### U2 — 신고 UI
- [DOW-1136](/DOW/issues/DOW-1136)이 확정한 패턴(sonner `toast`)을 그대로 씁니다. `window.prompt` 1곳 + `alert` 3곳 제거.
- 사유 입력은 화면 안 패널입니다(사유 버튼 4개 + 줄바꿈 되는 textarea). 숨김 처리되면 toast 후 `/`로 보냅니다.

### 곁다리 1건
페이지가 `params` Promise를 그대로 넘기고 클라이언트가 `React.use()`로 풀고 있었습니다. **`use()`는 React 19 API인데 이 저장소 react는 18.3**이라 화면을 단독 렌더할 수 없었습니다(테스트가 이걸로 먼저 깨졌습니다). `app/community/[id]/page.tsx`에서 서버가 `await`해 `id`를 넘기도록 바꿨습니다. 2줄입니다.

### 검증 — 추정 아닌 실행
- 새 회귀 테스트 13건: UI 9건(`__tests__/components/community-post-view.test.tsx`) + API 4건(`__tests__/api/community-comment-rate-limit.test.ts`). 소스 grep이 아니라 실제 렌더/실제 요청으로 판정합니다.
- **대조군 확인:** 수정을 되돌려 테스트가 실제로 깨지는지 봤습니다. rate limit 제거 → 2건 실패(201이 와야 할 자리에 429 기대), 실패 삼킴 복원 → "댓글 0" 1건 실패. 통과만 보고 끝내지 않았습니다.
- 전체: `65 files / 648 tests` 통과, `tsc --noEmit` 통과, `eslint` 통과.
- **`next build`는 로컬에서 실패합니다 — 이번 변경과 무관합니다.** 확인 방법: 제 변경을 stash하고 같은 빌드를 돌렸더니 기준선도 실패했습니다(`/profile/edit` 프리렌더, `Cannot read properties of null (reading 'useContext')`). 제 변경이 있을 때 난 실패는 `/500`이었고 실행마다 페이지가 바뀝니다. 로컬 프리렌더 환경 문제로 보입니다. CI의 `npm run build` 결과를 봐야 확정할 수 있습니다.

### 브랜치 확인
커밋 전후로 확인했습니다. `main` → `origin/main` `62ecffd5`. 작업 중 다른 에이전트가 `3da23b9f`([DOW-1136](/DOW/issues/DOW-1136)) 포함 4개 커밋을 올렸고, stash/pop 과정에서 그쪽 작업이 유실되지 않았음을 로그로 확인했습니다. 스테이징은 제 파일 7개만 명시 경로로 했습니다.

### 넘긴 것
- [DOW-1163](/DOW/issues/DOW-1163) — 본인 글·댓글 수정/삭제 API 부재 + `comment_count` 정합성 + 목록 화면 배지 컴포넌트 전환. [DOW-1137](/DOW/issues/DOW-1137) 하위 backlog로 만들었습니다.

@CTO CI의 `npm run build` 결과만 확인 부탁드립니다. 로컬 빌드 실패가 기준선에도 있어서 제 쪽에서 확정할 수 없는 유일한 항목입니다."""

req = urllib.request.Request(
    u + '/api/issues/06a6e040-2202-451d-a0fc-22bd7af425ce',
    data=json.dumps({'status': 'done', 'comment': comment}).encode(),
    headers=H, method='PATCH',
)
d = json.load(urllib.request.urlopen(req))
iss = d.get('issue', d)
print(iss.get('identifier'), iss.get('status'))
