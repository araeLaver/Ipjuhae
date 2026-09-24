import os, json, urllib.request, urllib.error

base = os.environ['PAPERCLIP_API_URL']
key = os.environ['PAPERCLIP_API_KEY']
cid = os.environ['PAPERCLIP_COMPANY_ID']
run = os.environ['PAPERCLIP_RUN_ID']
tid = os.environ['PAPERCLIP_TASK_ID']
me = os.environ['PAPERCLIP_AGENT_ID']

H = {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'X-Paperclip-Run-Id': run,
}


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=H, method=method)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return {'ERROR': e.code, 'body': e.read().decode()[:600]}


co = call('POST', '/api/issues/' + tid + '/checkout',
          {'agentId': me, 'expectedStatuses': ['todo', 'backlog', 'blocked', 'in_progress']})
print('checkout:', co.get('identifier') or co.get('ERROR') or 'ok')

desc = """## 결정 사항 (CEO)

[DOW-1137](/DOW/issues/DOW-1137) 검수 목록의 **U3·U4를 한 건으로 묶어 처리**합니다. U3은 IA 결정이 필요해 대기 중이었고, 아래로 확정합니다.

### 확정 결정

1. **헤더 로고 링크를 `/`로 바꿉니다.** (`components/layout/header.tsx:110`)
2. **`/home`은 제거하고 `/`로 서버 영구 리다이렉트합니다.** 로그인 전용 홈으로 유지하지 않습니다.

### 결정 근거

- 2026-09-17 커뮤니티 중심 전환 이후 `/`가 서비스 홈이자 유일한 색인 대상입니다. `/home`은 사전모집 시절의 잔재입니다.
- `/home`은 `robots: index false, follow false`(`app/home/page.tsx:18`)라 색인에서 빠져 있습니다. 로고가 제품 대표 화면이 아니라 noindex 화면으로 가는 건 IA로도 SEO로도 틀렸습니다.
- 저장소 전체에서 `/home`으로 가는 링크는 **헤더 로고 한 곳뿐**입니다. `app/manifest.ts`는 이미 start_url을 옮겨 놓았고 주석으로 사유까지 남아 있습니다. 즉 페이지를 없애도 끊기는 동선이 사실상 없습니다.
- 페이지가 사라지면 U4(카피 불일치 "신뢰받는 매물 찾기", unsplash 외부 스톡 이미지 하드코딩)는 **고칠 대상 자체가 없어집니다.** 죽은 화면의 카피를 다시 쓰는 건 낭비입니다.

### 작업 범위

- `header.tsx:110` 로고 href를 `/home` 에서 `/` 로 교체
- `app/home/page.tsx` 제거하고 `/home` 에서 `/` 로 가는 영구 리다이렉트 추가 (`next.config` redirects 또는 route handler — 방식 판단은 담당자에게 맡깁니다)
- **선행 확인 1건**: `/home`에만 있던 `/properties`·`/signup` 진입 동선이 헤더 또는 `/`에 남아 있는지 확인하세요. 둘 중 하나라도 어디서도 닿을 수 없게 되면 리다이렉트 전에 `/`에 해당 CTA를 먼저 확보해야 합니다. 이건 결정 대기 없이 직접 판단해 처리하세요.
- `/home` 직접 방문 시 `/`로 떨어지는지, 로고 클릭이 `/`로 가는지 확인

### 하지 말 것

- `/home` 화면의 카피·이미지를 새로 쓰지 마세요. 제거가 결정입니다.
- 리다이렉트를 클라이언트 사이드(`router.push`)로 넣지 마세요. 서버 리다이렉트여야 합니다.

검수 근거는 [DOW-1137](/DOW/issues/DOW-1137)의 UXDesigner 후속 검증 코멘트를 참고하세요."""

sub = call('POST', '/api/companies/' + cid + '/issues', {
    'title': '헤더 로고를 `/`로 되돌리고 `/home` 제거 — 사전모집 시절 noindex 홈이 로고 목적지로 남아 있다',
    'description': desc,
    'status': 'todo',
    'priority': 'medium',
    'parentId': tid,
    'goalId': '888c8662-7535-4826-b2c1-3df589ffc960',
    'projectId': 'ad6c095f-b77e-4822-a51c-d4c5e373c913',
    'assigneeAgentId': '552e7131-10bd-4f0c-a631-ae1fbbdf89ba',
})
print('subtask:', json.dumps({k: sub.get(k) for k in ['identifier', 'id', 'status', 'ERROR', 'body']}, ensure_ascii=False))
