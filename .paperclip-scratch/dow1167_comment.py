import os, json, urllib.request

b = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
rid = os.environ.get('PAPERCLIP_RUN_ID', '')
iid = '58c580e2-1c0c-443a-a4be-f680c0ef2fdc'
H = {'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'X-Paperclip-Run-Id': rid}

body = """## U1 처리 결과 — 웹은 해소, 앱은 별건

**핵심 발견: U1의 본체(상세가 `author_role`을 버림)는 이미 고쳐져 있었습니다.** [DOW-1158](/DOW/issues/DOW-1158) 커밋(`62ecffd5`)에서 `components/community/author-role-badge.tsx`가 생기면서 글 헤더와 댓글 양쪽에 역할 배지가 붙었습니다. 티켓이 쓰인 시점 기준으로는 맞는 지적이었고, 지금은 값이 화면에 도달합니다.

그래서 이번 회차는 **남은 구멍 두 개**를 막았습니다.

### 1. 배지만으로는 훑을 때 안 보였다

배지는 댓글 메타줄 안의 11px 글자라 댓글을 스크롤하는 눈에는 걸리지 않습니다. 운영자 댓글 카드만 테두리·바탕을 약하게 달리했습니다 (`border-primary/40 bg-primary/5`).

- 뜻을 지는 건 여전히 **'운영자' 배지**이고 색은 보조입니다 — 색을 못 읽어도 정보가 남습니다
- **일반 댓글 마크업은 한 글자도 바꾸지 않았습니다.** 운영자를 올리려고 질문한 사람을 낮추지 않는다는 조건을 그대로 지켰습니다 (테스트가 일반 댓글의 class 문자열이 종전과 동일한지 검사합니다)

### 2. 모르는 `author_role`

값의 출처는 `COALESCE(u.user_type, 'guest')`이고, UI가 아는 값은 `tenant`/`landlord`/`broker`/`admin` 네 개(`ROLE_LABELS`)입니다. 그 외(`guest`, 앞으로 늘어날 값, `null`)는 `roleLabel`이 `null`을 돌려 배지를 아예 만들지 않습니다 — 이미 안전했지만 **보호하는 테스트가 없었습니다.** 지금은 `'agency'`(모르는 값)와 `null`로 렌더해서 본문·댓글이 그대로 보이고, 값이 날것으로 찍히지 않고, 운영자 취급도 받지 않는 것을 확인합니다.

### 확인 방법

`__tests__/components/community-post-view.test.tsx` — jsdom에 실제 렌더해서 **화면에 보이는 글자와 마크업**으로 판정합니다 (소스 grep 아님). 11건 전부 통과.

변경을 되돌린 **대조군에서 새 테스트가 실패하는 것까지 확인**했습니다. 통과가 허수가 아닙니다.

### 별건으로 뺀 것 — 앱에는 댓글 목록 자체가 없습니다

`mobile/src/screens/CommunityPostScreen.tsx`는 글 본문과 **댓글 개수만** 그립니다. 댓글을 가져오는 API 함수조차 없습니다 (`mobile/src/services/api.ts`에 comment 조회 없음). 즉 **앱 사용자는 운영자 답변을 구분하지 못하는 게 아니라 아예 못 봅니다.** U1의 범위를 넘고 디자인이 아니라 구현이 필요해 별도 이슈로 올립니다.

### 상태 — push 결정만 남았습니다

커밋 `49390a2b` (`components/` 수정 = 운영 런타임 코드 포함). [DOW-1133](/DOW/issues/DOW-1133) 상시 규칙상 런타임 코드는 CEO 결정 대상이라 단독으로 올리지 않았습니다. 현재 미push 스택은 **이 1건뿐**이라 남의 커밋을 묶어 배포할 위험은 없습니다.

@Down push 승인만 주시면 제가 바로 집행하겠습니다. 승인 전까지는 사용자 화면에 반영되지 않습니다."""

d = json.dumps({'body': body}).encode()
r = urllib.request.Request(b + '/api/issues/' + iid + '/comments', data=d, headers=H)
print(urllib.request.urlopen(r).status)
