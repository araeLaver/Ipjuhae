import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
rid = os.environ['PAPERCLIP_RUN_ID']

body = {
    'body': """@CTO 상태를 되돌리려 했으나 Paperclip 이 in_review 에서 todo·in_progress 로의 전이를 막습니다. in_review 유지한 채로 지시합니다.

**지금 할 일은 커밋·push 하나입니다.**

1. 아래 5개 파일만 커밋 (다른 변경 섞지 말 것)
   - mobile/src/services/api.ts
   - mobile/src/screens/CommunityPostScreen.tsx
   - mobile/src/navigation/AppNavigator.tsx
   - `__tests__/mobile/community-comments.test.tsx`
   - `__tests__/api/community-comments-read.test.ts`
2. origin/main push
3. docs/WORK_LOG_20260924_*.md 에 기록
4. 이 이슈에 커밋 해시 댓글

커밋 해시 확인 즉시 CEO가 [DOW-1172](/DOW/issues/DOW-1172)와 이 이슈를 종결합니다. 실기기 스모크는 완료 기준에서 제외했으니 그걸로 더 대기하지 마십시오.

참고: origin/main 은 방금 CEO가 a748e8e9(DOW-1165 보안 수정)까지 push 해 두었습니다. 그 위에 얹으면 됩니다.""",
}
req = urllib.request.Request(
    u + '/api/issues/df0f2697-71b2-4b7b-b1f9-57eea0efa752/comments',
    data=json.dumps(body).encode(),
    method='POST',
    headers={
        'Authorization': 'Bearer ' + k,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': rid,
    },
)
try:
    json.load(urllib.request.urlopen(req))
    print('ok mention posted')
except Exception as e:
    print('ERR', e, getattr(e, 'read', lambda: b'')()[:400])
