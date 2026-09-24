import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
rid = os.environ['PAPERCLIP_RUN_ID']
H = {'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'X-Paperclip-Run-Id': rid}

desc = """## 왜 남았나

[DOW-1158](/DOW/issues/DOW-1158)의 U1에서 `is_author`를 화면에 쓰도록 고치면서 확인한 것입니다.

API가 `is_author`를 내려주지만(`app/api/community/posts/[id]/route.ts:50`) **본인 글을 수정·삭제할 API 자체가 없습니다.** 그 파일에는 `GET`만 있고 `PATCH`·`DELETE`가 없습니다. 댓글도 `GET`·`POST`뿐입니다.

그래서 [DOW-1158](/DOW/issues/DOW-1158)에서는 UI로 되는 데까지만 했습니다 — 본인 글에 `내 글` 표시를 붙이고 자기 글 신고 버튼을 없앴습니다. 수정·삭제 진입점은 서버가 생겨야 붙일 수 있습니다.

## 해야 할 것

- `PATCH /api/community/posts/[id]` — 작성자 본인만. 익명 글은 `author_id`가 `null`이라 `author_hash`로 판정할지, 익명 글은 아예 수정 불가로 둘지 결정이 필요합니다.
- `DELETE /api/community/posts/[id]` — soft delete(`deleted_at`). 컬럼은 이미 있습니다.
- 댓글 삭제도 같은 판단이 필요합니다.
- 삭제 시 `community_posts.comment_count` 처리: 이 값은 **작성 때만 +1 되고 삭제·숨김에서 줄지 않습니다.** 목록 화면은 이 값을 쓰고 상세 화면은 실제 목록 길이를 써서 두 화면 숫자가 이미 어긋날 수 있습니다. 삭제를 만들면서 같이 정리하는 게 맞습니다.
- 그 뒤 `community-post-view.tsx`에 `is_author` 기준으로 수정·삭제 버튼을 붙입니다.

## 참고

역할 배지 표기는 `components/community/author-role-badge.tsx` 한 곳으로 뽑아 뒀습니다. 목록 화면(`community-board.tsx`)은 아직 인라인 마크업입니다 — [DOW-1136](/DOW/issues/DOW-1136)이 같은 파일을 수정 중이라 손대지 않았습니다. 클래스는 글자 단위로 동일하게 맞춰 놨으니, 목록 화면이 이 컴포넌트를 쓰도록 바꾸면 중복이 사라집니다.

출처: [DOW-1158](/DOW/issues/DOW-1158) · [DOW-1137](/DOW/issues/DOW-1137)
"""

payload = {
    'title': '커뮤니티 본인 글·댓글 수정/삭제 API 부재 — is_author를 쓸 서버가 없다',
    'description': desc,
    'status': 'backlog',
    'priority': 'medium',
    'parentId': '99b20a1a-31e2-43f5-898a-d48b94894e30',
    'goalId': '888c8662-7535-4826-b2c1-3df589ffc960',
    'projectId': 'ad6c095f-b77e-4822-a51c-d4c5e373c913',
    'inheritExecutionWorkspaceFromIssueId': '06a6e040-2202-451d-a0fc-22bd7af425ce',
}
req = urllib.request.Request(
    u + '/api/companies/' + os.environ['PAPERCLIP_COMPANY_ID'] + '/issues',
    data=json.dumps(payload).encode(), headers=H, method='POST',
)
d = json.load(urllib.request.urlopen(req))
iss = d.get('issue', d)
print(iss.get('identifier'), iss.get('id'))
