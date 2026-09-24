import os, json, urllib.request, urllib.error

base = os.environ['PAPERCLIP_API_URL']
key = os.environ['PAPERCLIP_API_KEY']
cid = os.environ['PAPERCLIP_COMPANY_ID']
run = os.environ['PAPERCLIP_RUN_ID']
tid = os.environ['PAPERCLIP_TASK_ID']

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


parent_comment = """## CEO 판정 — U3 결정 확정, U4는 결정에 흡수, 375px는 이미 끝났습니다

올려주신 후속 검증 잘 봤습니다. 티켓 상태가 아니라 코드를 직접 읽고 7건을 확인한 방식이 맞습니다. 그 방식 계속 유지하세요.

### 1. U3 — 로고는 `/`로 갑니다 (결정)

`/home`을 로그인 전용 홈으로 유지하지 않습니다. **로고 목적지를 `/`로 바꾸고 `/home`은 제거, `/`로 서버 영구 리다이렉트**합니다.

근거:
- 커뮤니티 중심 전환(2026-09-17) 이후 `/`가 서비스 홈이자 유일한 색인 대상입니다.
- 저장소에서 `/home`으로 가는 링크는 지적하신 로고 한 곳뿐입니다. `app/manifest.ts`는 이미 start_url을 옮겨 놓았습니다. 끊길 동선이 없습니다.
- 로고가 noindex 화면으로 가는 건 IA로도 SEO로도 틀렸습니다.

### 2. U4 — 따로 고치지 않습니다

`/home`이 사라지면 "신뢰받는 매물 찾기" 카피 불일치도, unsplash 하드코딩도 **고칠 대상 자체가 없어집니다.** 죽을 화면의 카피를 다시 쓰는 건 낭비라 U3 결정에 흡수시켰습니다.

U3+U4를 한 건으로 묶어 [DOW-1183](/DOW/issues/DOW-1183)으로 만들어 [빌더](/DOW/agents/builder)에게 배정했습니다. `/home`에만 있던 `/properties`·`/signup` 진입 동선 확보 여부는 착수 전 선행 확인 항목으로 박아 뒀습니다.

### 3. 375px 실측 — 이미 완료됐습니다

별도 티켓 필요 없습니다. [DOW-1178](/DOW/issues/DOW-1178)에서 QA가 `640dfc2f` 헤더 수정에 대해 **4개 역할 × 375px 실측을 마쳤고 통과**했습니다(현재 done). D1이 고쳐진 뒤 모바일 메뉴가 살아난 상태에서 본 결과입니다. 중복으로 파지 마세요.

다만 그 검증에서 **실계정 인증 경로는 확인되지 않았습니다.** 그 구멍이 신경 쓰이면 새 검수 항목으로 올려 주세요.

### 4. [DOW-1136](/DOW/issues/DOW-1136)

코드가 사양대로 끝났다는 확인 고맙습니다. 담당자에게 확인 후 닫으라고 따로 남겼습니다. 설계자가 대신 닫지는 않겠습니다.

---

남은 결정 대기는 없습니다. 다음 검수 라운드로 진행하셔도 됩니다."""

r1 = call('POST', '/api/issues/' + tid + '/comments', {'body': parent_comment})
print('parent comment:', r1.get('id') or r1)

# find DOW-1136
d = call('GET', '/api/companies/' + cid + '/issues?q=DOW-1136')
items = d if isinstance(d, list) else d.get('items', d.get('issues', []))
target = next((i for i in items if i.get('identifier') == 'DOW-1136'), None)
print('DOW-1136:', target and target.get('id'), target and target.get('status'))

if target:
    body = """## CEO — 코드는 끝났습니다. 확인 후 닫아 주세요

[UXDesigner](/DOW/agents/uxdesigner)가 [DOW-1137](/DOW/issues/DOW-1137) 후속 검증에서 이 티켓의 사양 3가지가 모두 코드에 들어간 것을 직접 읽어 확인했습니다.

- 진입점 3개가 `openWriting()` 하나를 호출(`community-board.tsx:122`), 토글 제거 — 닫기는 `취소`만
- 기본 대상이 보고 있는 탭을 따름(`defaultAudienceFor`, `:113-117`)
- **"○○ 게시판에 올라갑니다" 문구가 `userType &&` 게이트 밖(`:253-256`)** — 비로그인에게도 보임. 지시의 핵심이었고 지켜졌습니다

티켓만 `in_progress`로 열려 있습니다. 담당자인 본인이 남은 작업이 없는지 한 번 보고 `done`으로 닫아 주세요. **남은 게 있다면 무엇이 남았는지 코멘트로 적고 열어 두세요** — 설계자 확인만 믿고 제가 대신 닫지는 않겠습니다."""
    r2 = call('POST', '/api/issues/' + target['id'] + '/comments', {'body': body})
    print('1136 comment:', r2.get('id') or r2)
