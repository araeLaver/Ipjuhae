import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ['PAPERCLIP_RUN_ID']

comment = """## 완료 — 패턴 4개 확정, 담당자 2명에게 전달 완료

문서: [패턴 확정문](/DOW/issues/DOW-1161#document-plan)

### 조사 결과

- sonner `toast`를 쓰는 파일이 이미 **38개**, 남은 `alert`/`confirm`/`window.prompt` 호출은 **15곳**입니다.
- 즉 새 패턴을 고르는 일이 아니라 **남은 15곳을 이미 이긴 패턴으로 모으는** 일이었습니다. 새로 만든 컴포넌트는 없고, 새로 들인 라이브러리도 없습니다.
- 확인 대화상자(`components/ui/alert-dialog.tsx`)·결과 화면(`components/ui/empty-state.tsx`)·인라인 경고(`components/ui/alert.tsx`)도 이미 있고 동작하는 선례가 있습니다.

### 확정한 4가지

| 패턴 | 쓰는 것 | 선례 |
| --- | --- | --- |
| **알림** | sonner `toast.success` / `toast.error`. `<Toaster>`는 `components/providers.tsx:23`에 전역 마운트 | `components/landlord/property-form.tsx:236-242` |
| **확인** | `components/ui/alert-dialog.tsx`. 파괴적 동작이면 `AlertDialogAction`에 `bg-destructive` 클래스 필수 | `app/profile/page.tsx:186-211` |
| **입력** | `window.prompt` 금지. 파괴적이지 않으면 화면 안 인라인 패널, 파괴적이면 `AlertDialog` 본문에 `Textarea`/`Input` | `components/community/community-post-view.tsx` 신고 패널 |
| **동작 후 이동** | **자동 이동이 기본값이 아닙니다.** 사용자가 그 이동을 직접 눌렀을 때만 즉시 이동, 아니면 `EmptyState`로 화면을 바꾸고 이동은 버튼으로 | `app/landlord/properties/[id]/page.tsx:77-78` (이쪽은 올바른 형태라 유지) |

하위 규칙 하나를 더 못 박았습니다 — **폼 검증 오류는 토스트가 아니라 입력 필드 아래 인라인 문구**입니다. 고칠 자리와 문구가 떨어져 있으면 안 됩니다. 15곳 중 2곳이 여기 해당합니다.

### 판단이 갈렸던 지점 두 개

**입력 대화상자를 새로 들이지 않았습니다.** `@radix-ui/react-dialog`는 설치돼 있지 않습니다. `components/ui/sheet.tsx`가 있긴 하지만 폭 280px 좌우 내비게이션 서랍이라 입력창으로 쓸 물건이 아닙니다. 그래서 입력을 두 갈래로 쪼갰습니다 — 파괴적이지 않으면 인라인 패널, 파괴적이면 이미 있는 `AlertDialog` 본문에 넣습니다. `AlertDialogContent`는 자식을 그대로 받으므로 라이브러리 추가 없이 확인과 입력이 한 화면에서 끝납니다.

**`alert` → `toast` 전환에서 가장 깨지기 쉬운 곳을 따로 금지 항목으로 뺐습니다.** 지금까지는 `alert`가 닫히는 동작 자체가 화면 전환의 설명 역할을 했습니다. `alert`만 토스트로 바꾸고 뒤따르는 `router.push`를 그대로 두면 그 설명이 사라지고 화면만 갑자기 바뀝니다. 두 담당자 모두 이 형태를 건드리는 중이라 양쪽 댓글에 같은 경고를 넣었습니다.

### 전달

문구를 글자까지 맞추는 표를 양쪽에 동일하게 넣었습니다. 같은 신고 동작이 보드와 상세에서 따로 처리되는 구조라, 여기가 어긋나면 이번 검수가 지적한 불일치가 그대로 재생산됩니다.

- [DOW-1158](/DOW/issues/DOW-1158) — U2 요약 전달. C-1(인라인 패널)·A(토스트)는 작업 트리에 이미 적용돼 있고, **D-2만 남았습니다.** `data?.hidden`일 때 `toast.success` 직후 `router.push('/')`를 부르는 자리를 `EmptyState`로 바꾸도록 구체 코드까지 넣었습니다.
- [DOW-1136](/DOW/issues/DOW-1136) — 보드 요약 전달. `components/community/community-board.tsx:159`는 이미 맞는 형태라 손대지 말라고 명시했습니다.

양쪽 다 제 승인을 기다리지 말라고 적었습니다.

### 따로 뺀 것

[DOW-1162](/DOW/issues/DOW-1162) — `components/listings/FavoriteButton.tsx`의 "관심 매물" 버튼은 `alert` 한 줄이 전부이고 **아무것도 저장하지 않습니다.** 패턴대로 `toast.success`로만 바꾸면 *저장되지도 않는데 저장됐다고 말하는 버튼*이 됩니다. 문구가 아니라 동작을 붙여야 하는 건이라 Fryndo에게 `low`로 넘겼습니다. 관심 매물 저장은 `components/landlord/favorite-button.tsx`에 이미 있으니 새로 만들 것 없이 가져다 쓰라고 적어 뒀습니다.

### 경계 준수

코드는 한 줄도 고치지 않았습니다. 기호·더미 예시 없이 전부 저장소에 실재하는 파일·줄 번호로 썼습니다."""

d = json.dumps({'status': 'done', 'comment': comment}).encode()
r = urllib.request.Request(
    u + '/api/issues/913c5862-3cf9-4cca-a5d0-4eb9f9da3c8b',
    data=d,
    headers={
        'Authorization': 'Bearer ' + k,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': RUN,
    },
    method='PATCH',
)
try:
    j = json.loads(urllib.request.urlopen(r).read())
    print('OK', j.get('status'))
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:600])
