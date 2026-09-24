import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ['PAPERCLIP_RUN_ID']
DOC = '/DOW/issues/DOW-1161#document-plan'

c1158 = """## 패턴 확정됨 — 적용 때 이 문서를 따르세요

[DOW-1161](/DOW/issues/DOW-1161)에서 알림·확인·입력·이동 4개 패턴을 확정했습니다. 승인 기다리실 것 없이 바로 쓰시면 됩니다.

- 문서: [패턴 확정문](DOCLINK)

**U2(신고 흐름)에 해당하는 부분만 요약합니다.**

- **입력** → `window.prompt` 금지. 화면 안 인라인 패널(`Textarea rows={3} maxLength={1000}` + 취소/실행 버튼). 작업 트리의 `components/community/community-post-view.tsx`에 이미 이 형태로 들어가 있습니다 — 그대로 두시면 됩니다.
- **알림** → sonner `toast`. `<Toaster>`는 `components/providers.tsx:23`에 이미 전역 마운트돼 있으니 따로 두지 마세요.
- **동작 후 이동** → **여기가 아직 남아 있습니다.** `data?.hidden`일 때 `toast.success` 직후 `router.push('/')`를 부르는데, 3초짜리 토스트와 화면 전환이 겹쳐서 사용자는 둘 중 하나를 놓칩니다. 사용자는 신고를 했지 화면을 떠나겠다고 한 적이 없습니다. 자동 이동 대신 본문 자리를 `components/ui/empty-state.tsx`로 바꾸고, 이동은 버튼으로 받으세요. `EmptyState`는 `icon` / `title` / `description` / `action` 을 받습니다 — `action`의 `onClick`에서 `router.push('/')`를 부르면 됩니다.

**문구는 [DOW-1136](/DOW/issues/DOW-1136)과 글자까지 맞춥니다** (같은 신고 동작이 두 화면에서 각각 처리되기 때문입니다):

| 상황 | 문구 |
| --- | --- |
| 접수, 글은 그대로 | `신고가 접수됐습니다. 운영자가 확인합니다.` |
| 접수, 글이 숨겨짐 | `신고가 접수됐습니다. 신고가 쌓여 이 글은 보이지 않게 처리됐습니다.` |
| 신고 실패 | 서버 문구 `?? '신고를 접수하지 못했습니다'` |

새 대화상자 라이브러리는 들이지 마세요 — `@radix-ui/react-dialog`는 설치돼 있지 않고, 이미 있는 `AlertDialog` + 인라인 패널로 다 됩니다.
재검수가 필요하면 이 티켓에서 불러 주세요."""

c1136 = """## 패턴 확정됨 — `alert()` 걷어내실 때 이 문서를 따르세요

[DOW-1161](/DOW/issues/DOW-1161)에서 알림·확인·입력·이동 4개 패턴을 확정했습니다. 제 승인 기다리실 것 없습니다.

- 문서: [패턴 확정문](DOCLINK)

**보드 쪽에 해당하는 부분만 요약합니다.**

- **알림** → sonner `toast` (`toast.success` / `toast.error`). `<Toaster>`는 `components/providers.tsx:23`에 이미 전역 마운트돼 있으니 화면에 따로 두지 마세요. 서버 문구는 `?? '한국어 기본 문구'`로 받쳐야 `undefined`가 토스트에 뜨지 않습니다. `components/community/community-board.tsx:159`는 이미 맞는 형태라 손대실 것 없습니다.
- **폼 검증 오류는 토스트가 아닙니다.** 값이 비었거나 형식이 틀린 건 해당 입력 필드 바로 아래 인라인 문구(`text-sm text-destructive`)로 쓰고, 실행 버튼은 `disabled`로 둡니다.
- **주의 — `alert`를 `toast`로만 바꾸고 뒤따르는 `router.push`를 그대로 두지 마세요.** 지금까지는 모달이 닫히는 동작이 화면 전환의 설명 역할을 했는데, 토스트로 바꾸면 그 설명이 사라지고 화면만 갑자기 바뀝니다. 이번 전환에서 가장 깨지기 쉬운 지점입니다. 사용자가 그 이동을 직접 누른 경우(삭제 → 목록 복귀)만 즉시 이동이 허용됩니다.

**문구는 [DOW-1158](/DOW/issues/DOW-1158)과 글자까지 맞춥니다** (같은 신고 동작이 보드와 상세에서 각각 처리되기 때문입니다):

| 상황 | 문구 |
| --- | --- |
| 접수, 글은 그대로 | `신고가 접수됐습니다. 운영자가 확인합니다.` |
| 접수, 글이 숨겨짐 | `신고가 접수됐습니다. 신고가 쌓여 이 글은 보이지 않게 처리됐습니다.` |
| 신고 실패 | 서버 문구 `?? '신고를 접수하지 못했습니다'` |
| 작성 실패 | 서버 문구 `?? '작성에 실패했습니다'` |

보드에서는 목록의 해당 글이 사라질 뿐이라 이동이 없습니다 — 토스트만 쓰시면 됩니다.
재검수가 필요하면 이 티켓에서 불러 주세요."""

targets = [
    ('06a6e040-2202-451d-a0fc-22bd7af425ce', c1158.replace('DOCLINK', DOC)),
    ('58054c6b-9987-46b5-855e-cf547541dffd', c1136.replace('DOCLINK', DOC)),
]

for iid, body in targets:
    d = json.dumps({'body': body}).encode()
    r = urllib.request.Request(
        u + '/api/issues/' + iid + '/comments',
        data=d,
        headers={
            'Authorization': 'Bearer ' + k,
            'Content-Type': 'application/json',
            'X-Paperclip-Run-Id': RUN,
        },
        method='POST',
    )
    try:
        print(iid, 'OK', json.loads(urllib.request.urlopen(r).read())['id'])
    except urllib.error.HTTPError as e:
        print(iid, e.code, e.read().decode()[:400])
