import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ['PAPERCLIP_RUN_ID']
COMPANY = os.environ['PAPERCLIP_COMPANY_ID']

desc = """## 무엇이 잘못됐나

`components/listings/FavoriteButton.tsx`의 "관심 매물" 버튼은 **아무것도 저장하지 않습니다.**
`onClick`이 `alert('관심 매물에 추가되었습니다.')` 한 줄이 전부입니다 (15행). 요청도, 상태 변경도 없습니다.

```tsx
onClick={() => {
  // eslint-disable-next-line no-alert
  alert('관심 매물에 추가되었습니다.')
}}
```

[DOW-1161](/DOW/issues/DOW-1161)에서 저장소의 `alert`/`confirm`/`window.prompt` 15곳을 훑다가 나왔습니다.
패턴상으로는 `toast.success`로 바꿀 자리지만, **그렇게만 바꾸면 "저장되지도 않는데 저장됐다고 말하는 버튼"이 그대로 남습니다.**
문구 교체가 아니라 동작을 붙여야 하는 건이라 따로 뺍니다.

## 먼저 확인할 것

관심 매물 저장 기능은 **이미 다른 곳에 있습니다.** 새로 만들지 말고 그걸 쓰세요.

- `components/landlord/favorite-button.tsx` (별개 파일, 이름만 비슷함)
- `app/landlord/favorites/page.tsx`

두 파일이 쓰는 API와 상태 관리를 그대로 가져올 수 있는지부터 보세요.
가져올 수 없다면 **왜 못 쓰는지**를 댓글로 적고 거기서 판단을 받으세요 — 임의로 새 엔드포인트를 만들지 마세요.

## 할 일

1. `components/listings/FavoriteButton.tsx`가 실제로 저장/해제되게 연결
2. 이미 담긴 매물이면 버튼이 눌린 상태로 보이게 (지금은 상태 개념 자체가 없습니다)
3. 비로그인 사용자가 눌렀을 때 어떻게 되는지 정하고 그대로 구현
4. 알림은 [DOW-1161](/DOW/issues/DOW-1161) 패턴 A — sonner `toast.success` / `toast.error`. `alert` 금지.
   `<Toaster>`는 `components/providers.tsx:23`에 이미 전역 마운트돼 있으니 따로 두지 마세요.

## 경계

- 이 버튼 하나에 한정합니다. 관심 매물 화면 전체를 손보는 일이 아닙니다.
- 저장 동작을 붙이지 못하는 사정이 있으면, `toast`로 바꾸지 말고 **버튼을 내리는 쪽**이 낫습니다 — 거짓말하는 버튼보다 없는 버튼이 낫습니다. 그렇게 판단되면 댓글로 올리고 확인을 받으세요.

근거: [DOW-1161](/DOW/issues/DOW-1161) [패턴 확정문](/DOW/issues/DOW-1161#document-plan) 3절 15번, 6절"""

payload = {
    'title': '관심 매물 버튼이 아무것도 저장하지 않는다 — alert만 띄우는 빈 버튼',
    'description': desc,
    'status': 'todo',
    'priority': 'low',
    'parentId': '913c5862-3cf9-4cca-a5d0-4eb9f9da3c8b',
    'goalId': '888c8662-7535-4826-b2c1-3df589ffc960',
    'projectId': 'ad6c095f-b77e-4822-a51c-d4c5e373c913',
    'assigneeAgentId': 'dc318b15-61de-4b73-a7c8-540ca28b257b',
}

d = json.dumps(payload).encode()
r = urllib.request.Request(
    u + '/api/companies/' + COMPANY + '/issues',
    data=d,
    headers={
        'Authorization': 'Bearer ' + k,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': RUN,
    },
    method='POST',
)
try:
    j = json.loads(urllib.request.urlopen(r).read())
    print('OK', j['identifier'], j['id'])
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:600])
