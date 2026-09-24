import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
rid = os.environ['PAPERCLIP_RUN_ID']
H = {'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json', 'X-Paperclip-Run-Id': rid}

comment = """## 패턴 D-2 적용 완료 — push까지 끝냈습니다

[DOW-1161](/DOW/issues/DOW-1161) [패턴 확정문](/DOW/issues/DOW-1161#document-plan) 3절 적용 표의 **16번**입니다. 지적하신 대로 C-1(인라인 패널)·A(toast)는 이미 맞았고 **D-2만 남아 있었습니다.** 커밋 `0876080f`, `origin/main` 반영 확인했습니다.

### 고친 것

`data?.hidden`일 때 `toast.success` 직후 `router.push('/')`를 부르던 부분을 없앴습니다. 본문 자리를 `EmptyState`로 바꾸고 이동은 버튼으로 받습니다.

문구·아이콘은 패턴 문서 D-2 예시를 그대로 썼습니다.

- `icon` — `<ShieldAlert className="h-10 w-10" />`
- `title` — `신고가 접수돼 이 글은 보이지 않게 됐습니다`
- `description` — `운영자가 확인합니다. 결과는 따로 안내되지 않습니다.`
- `action` — `커뮤니티로 돌아가기` → `router.push('/')`

토스트 문구 3종은 4절 표 그대로 유지했습니다([DOW-1136](/DOW/issues/DOW-1136)과 글자까지 동일). 새 라이브러리는 들이지 않았습니다 — `EmptyState`·`lucide-react` 모두 이미 있었습니다.

### 판단이 갈릴 수 있는 지점 하나

**숨김일 때 toast와 EmptyState가 둘 다 뜹니다.** 문서가 4절 표에서 양쪽 화면 공통 문구로 `신고가 접수됐습니다. 신고가 쌓여 이 글은 보이지 않게 처리됐습니다.` 를 못 박았고, D-2 금지 항목은 "토스트만 띄우고 `router.push`를 같이 부르는 것"이라 **이동이 없으면 토스트는 유실되지 않는다**고 읽었습니다. 메시지가 겹친다고 보시면 토스트를 빼겠습니다 — 한 줄입니다.

### 검증

- 회귀 테스트의 판정 기준을 바꿨습니다: "자동 이동했는가" → **"결과 화면이 뜨고, 본문이 치워졌고, 이동은 버튼을 눌렀을 때만 일어나는가"**. 숨겨졌다고 말해 놓고 본문을 그대로 두면 말과 화면이 어긋나므로 그것도 같이 봅니다.
- **대조군:** 자동 이동을 되살려 테스트가 실제로 깨지는 것 확인했습니다.
- 전체 `65 files / 650 tests` 통과, `tsc --noEmit`·`eslint` 통과.

### 이 티켓에서 제 몫은 끝났습니다

D3·D4·U1·D5·U2 + D-2까지 전부 반영했습니다. 남은 것은 별건으로 이미 나가 있습니다.

- [DOW-1163](/DOW/issues/DOW-1163) — 본인 글·댓글 수정/삭제 API 부재 (`is_author`를 쓸 서버가 없음) + `comment_count` 정합성 + 목록 화면 배지 컴포넌트 전환
- 작업 기록: `docs/WORK_LOG_20260924_DOW1158_COMMUNITY_POST_VIEW.md`

@UXDesigner 재검수 부탁드립니다. 특히 위 "판단이 갈릴 수 있는 지점"(토스트 + EmptyState 중복 여부) 하나만 판정해 주시면 됩니다. 빼는 쪽이면 바로 처리하겠습니다."""

req = urllib.request.Request(
    u + '/api/issues/06a6e040-2202-451d-a0fc-22bd7af425ce',
    data=json.dumps({'status': 'done', 'comment': comment}).encode(),
    headers=H, method='PATCH',
)
d = json.load(urllib.request.urlopen(req))
iss = d.get('issue', d)
print(iss.get('identifier'), iss.get('status'))
