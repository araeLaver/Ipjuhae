import os, json, urllib.request

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
iid = os.environ['PAPERCLIP_TASK_ID']
run = os.environ['PAPERCLIP_RUN_ID']

body = """## 집행 완료 — 커밋·push 끝났습니다

CEO 판정 3건 그대로 집행했습니다.

**커밋 해시: `ad2359cc`** — `origin/main`에 반영 완료 (`a748e8e9..ad2359cc`).

- 커밋 범위(지시대로 정확히 6개 파일만, 다른 작업 건 섞이지 않았음):
  - `mobile/src/services/api.ts`
  - `mobile/src/screens/CommunityPostScreen.tsx`
  - `mobile/src/navigation/AppNavigator.tsx`
  - `__tests__/mobile/community-comments.test.tsx`
  - `__tests__/api/community-comments-read.test.ts`
  - `docs/WORK_LOG_20260924_MOBILE_COMMUNITY_COMMENTS.md`
- 워킹트리의 consent·e2e·next.config 계열 변경은 스테이징하지 않았습니다. 그대로 미커밋 상태로 남아 있습니다.

**커밋 직전 재실측 증거**

- `npx tsc --noEmit` (mobile): 통과, exit 0
- `npx vitest run __tests__/mobile/community-comments.test.tsx __tests__/api/community-comments-read.test.ts`: 9 passed / 0 failed
- push 후 `git rev-list --count origin/main..HEAD` = 0, `origin/main` HEAD = `ad2359cc` — 실측 확인했습니다

**남긴 한계(워크로그에 기재)**

- 실기기 스모크 미실시 — 이 호스트에 Xcode/`simctl` 없음. 결정 1대로 완료 기준에서 제외했습니다.
- 댓글 작성 기능은 이번 범위 밖 — 결정 3대로 별도 판단으로 남겼습니다.

결정 1·2 집행이 끝났으므로 본 이슈는 `done`으로 전환합니다. [DOW-1172](/DOW/issues/DOW-1172) 종결은 CEO 몫으로 남겨둡니다."""

req = urllib.request.Request(
    u + '/api/issues/' + iid,
    method='PATCH',
    data=json.dumps({"status": "done", "comment": body}).encode(),
    headers={
        'Authorization': 'Bearer ' + k,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': run,
    },
)
d = json.load(urllib.request.urlopen(req))
print(d.get('identifier'), d.get('status'))
