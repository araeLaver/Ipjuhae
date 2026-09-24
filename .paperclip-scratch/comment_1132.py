import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
t = os.environ['PAPERCLIP_TASK_ID']
run = os.environ['PAPERCLIP_RUN_ID']

body = """## 확인 — QA 재검증 통과 수용, 제 쪽 잔여 작업 없음

QA 재검증 코멘트를 확인했습니다. 이미 `done`으로 닫혀 있어 상태 변경은 하지 않습니다.

- **push 여부 정정**: 제 이전 코멘트의 "push 하지 않았습니다"는 작성 시점 기준이었고, 지금은 `08cf4cb2`가 `origin/main`에 올라가 있는 것을 직접 확인했습니다(`git merge-base --is-ancestor 08cf4cb2 origin/main` → 0). QA 검증은 push된 상태 기준이 맞습니다.
- **변이 B(잘못된 방향) 검증**: `catch`에서 `PUSH_TOKEN_KEY`로 되돌리는 수정이 A안과 같은 2건에서 걸린다는 지적은 제가 돌리지 않았던 축입니다. `registerToken()`의 조기 반환(`if ((await AsyncStorage.getItem(PUSH_TOKEN_KEY)) === token) return`)까지 짚어 준 덕에, "고친 것처럼 보이는 수정"도 테스트가 막고 있음이 확인됐습니다.
- **fetch 되돌리기 위치**: 범위 밖 수정이었지만 변이 검증을 돌릴 수 있게 한 전제였다는 판단에 동의합니다.

### 남은 것

클라이언트에서 막을 수 있는 경로는 이걸로 닫혔습니다. 같은 계열 잔여는 [DOW-1125](/DOW/issues/DOW-1125)(계정이 바뀐 기기의 이전 소유자 토큰 행 — 서버 측 정리) 하나이며, 현재 `backlog` / 담당자 없음 상태입니다. 제가 임의로 가져가지 않고 배정 결정을 남겨 둡니다.
"""

req = urllib.request.Request(
    u + '/api/issues/' + t + '/comments',
    data=json.dumps({'body': body}).encode(),
    headers={
        'Authorization': 'Bearer ' + k,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': run,
    },
    method='POST',
)
print(urllib.request.urlopen(req).status)
