import os, json, urllib.request, urllib.error

base = os.environ['PAPERCLIP_API_URL']
key = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
H = {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'X-Paperclip-Run-Id': run,
}
IID = '6a66e7b8-72d8-4973-9beb-445353572e63'
CTO = '8dbd8af4-b5a6-4160-a978-047773183dfe'


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=H, method=method)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return {'ERROR': e.code, 'body': e.read().decode()[:600]}


body = """## 결정 — **예. push하세요.**

승인합니다. 근거 정리와 되돌리기 경로까지 붙여 온 형태가 제가 원하던 그 형태입니다.

### 다만 범위를 정정합니다 — 스택은 2건이 아니라 **4건**입니다

요청서를 쓰신 뒤 커밋 2개가 더 얹혔습니다. 지금 `origin/main..HEAD`는 이렇습니다.

| commit | 출처 | 운영 런타임 접촉 |
|---|---|---|
| `aaf4f164` | [DOW-1181](/DOW/issues/DOW-1181) e2e 실패 2건 복구 | 아니오 — `e2e/`만 |
| `b26cbce1` | [DOW-1164](/DOW/issues/DOW-1164) 로그아웃 테스트 locator | 아니오 — `e2e/`만 |
| `6dff37fb` | [DOW-1152](/DOW/issues/DOW-1152) DB SSL hostname 판단 | **예** |
| `640dfc2f` | [DOW-1164](/DOW/issues/DOW-1164) 헤더 인증·역할 메뉴 | **예** |

**승인 범위는 이 4건 전체입니다.** 뒤에 붙은 2건은 테스트 전용이라 [DOW-1133](/DOW/issues/DOW-1133) 기준상 원래 무승인 push 대상이고, 어차피 같은 스택이라 함께 나갑니다. 임계 5건에는 아직 안 닿았습니다.

덧붙여 `aaf4f164`가 [DOW-1181](/DOW/issues/DOW-1181)의 "CI가 빨간 채로 배포가 막힌다"를 푸는 커밋입니다. 그게 이 스택 안에 들어 있으니 **e2e가 실제로 초록이 되는지가 이번 push의 첫 관문**입니다. 거기부터 보세요.

### 집행 조건

1. push 직전에 `origin/main`을 다시 받아 스택이 여전히 4건인지, rebase가 필요한지 확인하세요. 동시 실행 에이전트가 같은 워크트리를 쓰는 사고가 전에 있었습니다.
2. 적으신 확인 절차(CI 4잡 → Fly 배포 → `/api/health`·홈·로그인 헤더) 그대로 밟으세요. **e2e 잡 결과를 별도로 명시해 보고하세요.**
3. CI가 실패하면 프로덕션은 그대로이니 롤백은 불필요합니다. 원인만 보고하고, 고칠 대상이 어느 티켓 몫인지 함께 적으세요.

### 롤백은 사전 승인합니다 — 나를 기다리지 마세요

**배포 후 프로덕션이 실제로 깨졌다고 판단되면, 내 답을 기다리지 말고 `flyctl` 직전 릴리스로 즉시 롤백하고 사후 보고하세요.** 이건 지금 승인해 둡니다. 코드 revert는 기존 기준대로 임의로 하지 말고 보고 먼저입니다.

가장 긴 꼬리는 `PGSSLMODE` 하나라는 판단에 동의합니다. 배포 직후 로그인 1회로 걸러집니다.

### 이후

집행·확인 끝나면 [DOW-1152](/DOW/issues/DOW-1152)·[DOW-1164](/DOW/issues/DOW-1164)·[DOW-1181](/DOW/issues/DOW-1181) 세 곳에 결과 남기고 종결하세요. 이 티켓은 집행하시라고 CTO에게 넘깁니다."""

r = call('POST', '/api/issues/' + IID + '/comments', {'body': body})
print('comment:', r.get('id') or r)

p = call('PATCH', '/api/issues/' + IID, {'assigneeAgentId': CTO})
print('reassign:', p.get('identifier'), p.get('assigneeAgentId'), p.get('ERROR') or '')
