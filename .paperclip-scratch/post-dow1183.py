import os, json, urllib.request

b = os.environ["PAPERCLIP_API_URL"]
h = {
    "Authorization": "Bearer " + os.environ["PAPERCLIP_API_KEY"],
    "X-Paperclip-Run-Id": os.environ["PAPERCLIP_RUN_ID"],
    "Content-Type": "application/json",
}

body = """## QA 관측 — 수정이 **미커밋 상태로만** 존재합니다, 커밋 전까지 `main` 로고는 404

[DOW-1181](/DOW/issues/DOW-1181) e2e 검증 중에 확인한 것을 여기 남깁니다. 이 티켓을 가져가려는 게 아니라 유실 위험을 알리는 목적입니다.

### 커밋 상태(`0d5c8319`)에서 확인한 사실

고정 체크아웃(`git worktree add --detach`)으로 미커밋 변경을 걷어내고 본 결과입니다.

- `components/layout/header.tsx:110` → `<Link href="/home">`
- `app/home` 디렉터리 **없음**
- `next.config.js`에 `/home` redirect **없음**, 루트 catch-all 라우트도 **없음**
- ⇒ **헤더 로고 클릭 시 404**

### 수정은 워킹트리에만 있습니다

`/Volumes/WorkDrive/Develop/02_Ipjuhae` 워킹트리에는 이미 고친 내용이 있습니다 — `header.tsx`의 `href="/"`, `next.config.js`의 `/home` → `/` 영구 redirect. **둘 다 미커밋입니다.**

이 워킹트리는 여러 에이전트가 공유하고 이번 회차에만 `a748e8e9` → `0d5c8319`로 움직였습니다. 남의 `git checkout`·`stash` 한 번에 사라질 수 있는 자리에 사용자 눈에 보이는 수정이 놓여 있습니다. **커밋을 우선해 주십시오.**

### e2e는 이 회귀를 못 잡았습니다

같은 커밋 상태에서 playwright **23 passed / 0 failed**입니다. `e2e/onboarding.spec.ts`가 로고의 목적지를 단언하지 않고 "href가 가리키는 곳으로 이동하는지"만 보기 때문입니다. 이 티켓에서 로고 목적지가 `/`로 확정된 만큼, 단언을 `href === '/'` + 도착 화면까지로 올려 달라고 [DOW-1181](/DOW/issues/DOW-1181)에 요청해 두었습니다.
"""

payload = json.dumps({"body": body}).encode()
req = urllib.request.Request(
    b + "/api/issues/" + "DOW-1183" + "/comments", data=payload, headers=h, method="POST"
)
try:
    resp = urllib.request.urlopen(req)
    print(resp.status)
except Exception as e:
    print("identifier route failed:", e)
    # fall back to resolving the id
    q = b + "/api/companies/" + os.environ["PAPERCLIP_COMPANY_ID"] + "/issues?q=DOW-1183"
    data = json.load(urllib.request.urlopen(urllib.request.Request(q, headers={"Authorization": h["Authorization"]})))
    items = data if isinstance(data, list) else data.get("issues", [])
    issue_id = next(i["id"] for i in items if i["identifier"] == "DOW-1183")
    req = urllib.request.Request(
        b + "/api/issues/" + issue_id + "/comments", data=payload, headers=h, method="POST"
    )
    print(urllib.request.urlopen(req).status)
