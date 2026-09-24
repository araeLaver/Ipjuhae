import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
c = os.environ['PAPERCLIP_COMPANY_ID']
run = os.environ['PAPERCLIP_RUN_ID']
me = os.environ['PAPERCLIP_AGENT_ID']


def call(path, body, method='POST'):
    r = urllib.request.Request(
        u + path,
        data=json.dumps(body).encode(),
        headers={
            'Authorization': 'Bearer ' + k,
            'Content-Type': 'application/json',
            'X-Paperclip-Run-Id': run,
        },
        method=method,
    )
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'ERR': e.code, 'body': e.read().decode()[:400]}


desc = """## 무엇이 깨져 있는가

[DOW-1164](/DOW/issues/DOW-1164) QA 검증([DOW-1178](/DOW/issues/DOW-1178))에서 전체 e2e를 돌린 결과 **20 passed / 3 failed / 7 skipped**가 나왔습니다. 그중 1건은 [DOW-1164](/DOW/issues/DOW-1164)에서 locator를 고쳐 해소했고, 남은 **2건은 09-17 커뮤니티 전환 때부터 깨져 있던 것**입니다. 제품 결함이 아니라 테스트가 변경을 따라오지 않은 것입니다.

| 파일 | 기대 | 실제 |
|---|---|---|
| `e2e/auth.spec.ts:6` | `입주해 - 안전한 임대의 시작` | `입주해 | 계약 전에 보증금이 안전한지 확인하는 곳` |
| `e2e/onboarding.spec.ts:53` | 로고 클릭 후 `/` | `/home` |

## 왜 지금 올리는가

둘 다 **CI를 빨갛게 만듭니다.** `.github/workflows/fly.yml`이 main push → CI 성공 → Fly 배포 구조라, 이 2건이 남아 있으면 미push 스택 전체가 배포 단계에서 막힙니다. [DOW-1164](/DOW/issues/DOW-1164) 수정을 실제로 올리려면 이게 선행입니다.

## 할 일

1. `e2e/auth.spec.ts:6` 기대 타이틀을 현재 카피에 맞춥니다. 카피 전문을 테스트에 하드코딩하면 다음 카피 변경에서 또 깨지므로, 상수 참조나 부분 일치 중 하나를 고르고 고른 이유를 남기세요.
2. `e2e/onboarding.spec.ts:53` — `components/layout/header.tsx:110`의 로고 `href`는 `/home`입니다. [DOW-1159](/DOW/issues/DOW-1159)에서 `/home`을 308 영구 리다이렉트로 처리하기로 승인됐으므로 **그 작업과 충돌하지 않게** 맞추세요. 현재 라우트 상태를 먼저 확인하고 시작합니다.
3. 전체 e2e를 다시 돌려 failed 0을 확인하고 결과를 붙입니다.

## 완료 기준

- `npx playwright test` 전량 통과(skip 제외)
- 카피나 라우트가 또 바뀌어도 같은 방식으로 깨지지 않는 근거 설명
"""

r = call('/api/companies/' + c + '/issues', {
    'title': '커뮤니티 전환 이후 방치된 e2e 실패 2건 — CI가 빨간 채로 배포가 막힌다',
    'description': desc,
    'status': 'todo',
    'priority': 'high',
    'projectId': 'ad6c095f-b77e-4822-a51c-d4c5e373c913',
    'goalId': '888c8662-7535-4826-b2c1-3df589ffc960',
    'parentId': '99b20a1a-31e2-43f5-898a-d48b94894e30',
    'assigneeAgentId': me,
})
print(json.dumps(r if 'ERR' in r else {x: r.get(x) for x in ('id', 'identifier', 'status')}, ensure_ascii=False))
