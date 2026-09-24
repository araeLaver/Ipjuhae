import os, json, urllib.request

b = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
rid = os.environ.get('PAPERCLIP_RUN_ID', '')
cid = os.environ['PAPERCLIP_COMPANY_ID']
iid = '58c580e2-1c0c-443a-a4be-f680c0ef2fdc'
CEO = 'f6b770fa-e6aa-49b4-8e02-82a63a57e3b8'
H = {'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'X-Paperclip-Run-Id': rid}


def post(path, payload, method='POST'):
    d = json.dumps(payload).encode()
    r = urllib.request.Request(b + path, data=d, headers=H, method=method)
    return json.load(urllib.request.urlopen(r))


desc = """## 문제

[DOW-1167](/DOW/issues/DOW-1167) (U1 운영자 답변 구분) 처리 중 발견한 **별건**입니다.

앱의 커뮤니티 글 상세(`mobile/src/screens/CommunityPostScreen.tsx`)는 **댓글을 하나도 그리지 않습니다.** `댓글 {commentCount}` 숫자만 찍고 끝납니다. `mobile/src/services/api.ts`에는 댓글을 가져오는 함수조차 없습니다 (`fetchCommunityPost`만 있음).

즉 웹에서 U1을 고쳐도 **앱 사용자는 운영자 답변을 구분하지 못하는 게 아니라 아예 볼 수 없습니다.** 질문을 올린 사람이 앱으로 돌아와도 자기 질문에 답이 달렸는지 알 방법이 없고, 숫자만 "댓글 3"으로 늘어납니다.

## 왜 중요한가

커뮤니티 전환 방침은 **웹·앱 병행**입니다. 그리고 지금 커뮤니티에 답을 다는 주체는 운영자입니다. 답변이 앱에서 안 보이면 앱에서는 커뮤니티가 읽기 전용 게시판이 되고, 입주해가 파는 "확인해 주는 신뢰"가 앱 쪽에서는 전달되지 않습니다.

## 할 일

1. 앱 상세에 댓글 목록 표시 (서버 API `GET /api/community/posts/[id]/comments`는 이미 있고 `author_role`도 내려줍니다)
2. 웹과 **같은 역할 표기**를 쓸 것 — `ROLE_LABELS`가 앱에도 이미 있습니다 (`mobile/src/screens/CommunityScreen.tsx`). 운영자 답변은 웹과 동일한 기준으로 구분
3. 모르는 `author_role` 값이 와도 배지를 만들지 않고 화면이 깨지지 않을 것
4. 댓글 작성까지 넣을지는 범위 판단 필요 — 읽기만 먼저 해도 위 문제는 해소됩니다

## 주의

- 앱에서 직접 `fetch`를 쓰면 `x-mobile-client` 헤더가 빠져 CSRF 403으로 조용히 버려집니다. 반드시 `apiClient` 경유
- 개수는 서버의 `comment_count`를 쓰지 말 것 — 삭제·숨김에서 줄지 않아 실제 목록과 어긋납니다 (웹은 [DOW-1158](/DOW/issues/DOW-1158)에서 이미 실제 렌더 개수로 바꿨습니다)

## 완료 기준

- 앱 글 상세에서 댓글이 보이고, 운영자 답변이 웹과 같은 기준으로 구분됨
- 댓글 조회 실패가 "댓글 0"으로 보이지 않음
- 모르는 역할 값에 깨지지 않음

## 배정

구현 작업이라 디자인 큐가 아닙니다. 담당 배정을 CEO께 요청드립니다."""

created = post('/api/companies/' + cid + '/issues', {
    'title': '앱 커뮤니티 글 상세에 댓글 목록이 없어 운영자 답변을 아예 못 본다',
    'description': desc,
    'status': 'todo',
    'priority': 'high',
    'parentId': '99b20a1a-31e2-43f5-898a-d48b94894e30',
    'goalId': '888c8662-7535-4826-b2c1-3df589ffc960',
    'projectId': 'ad6c095f-b77e-4822-a51c-d4c5e373c913',
    'assigneeAgentId': CEO,
})
ident = created.get('identifier')
print('created', ident, created.get('id'))

follow = """## 후속 이슈 등록

앱 쪽 별건을 [%s](/DOW/issues/%s)로 올렸습니다 — 앱 글 상세에 댓글 목록이 없어 운영자 답변을 아예 못 보는 문제입니다. 구현 작업이라 담당 배정은 CEO께 넘겼습니다.

이 이슈는 **push 승인 대기**로 넘깁니다. 웹 변경은 커밋까지 끝났고 테스트도 대조군까지 확인했습니다. 승인이 오면 제가 push하고 done 처리하겠습니다.""" % (ident, ident)

post('/api/issues/' + iid, {
    'status': 'in_review',
    'assigneeAgentId': CEO,
    'comment': follow,
}, method='PATCH')
print('handed off')
