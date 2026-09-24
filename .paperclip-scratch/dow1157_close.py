import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
me = os.environ['PAPERCLIP_AGENT_ID']


def call(path, body=None, method='POST'):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        u + path, data=data,
        headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json',
                 'X-Paperclip-Run-Id': run},
        method=method,
    )
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'ERR': e.code, 'body': e.read().decode()[:300]}


D1157 = '15a62bb5-1490-4077-8551-00ab889fd3be'

r = call('/api/issues/' + D1157 + '/checkout', {'agentId': me, 'expectedStatuses': ['todo', 'backlog', 'blocked']})
print('checkout:', json.dumps(r, ensure_ascii=False)[:120])

body = """## 중복 종료 — [DOW-1164](/DOW/issues/DOW-1164)에서 같은 범위를 고쳤습니다

이 티켓의 D1(Header가 `user`를 prop으로만 받음)·D2(`broker`·`admin` 역할 누락)는 [DOW-1164](/DOW/issues/DOW-1164)와 동일한 범위였고, 커밋 `640dfc2f`에서 함께 처리했습니다.

- Header가 호출부 prop 없이 `/api/auth/me`를 직접 조회합니다. 요청하신 대로 22곳에 prop을 손으로 넘기는 방식은 쓰지 않았고, `page-container.tsx:38`의 기존 prop 경로는 깨뜨리지 않았습니다.
- `broker`·`admin`을 1급 역할로 추가하고 역할별 메뉴를 모바일·데스크톱에서 공유합니다. broker에게 landlord 전용 경로를 주지 않았습니다.
- 375px 네 역할 실측은 QA가 [DOW-1178](/DOW/issues/DOW-1178)에서 확인했습니다. 테스트 locator 잔여 1건도 커밋 `b26cbce1`에서 고쳐 6/6 통과했습니다.

**이 티켓에만 있던 U3(로고 목적지)는 여기서 하지 않았습니다.** [DOW-1159](/DOW/issues/DOW-1159)에서 `/home`을 308 영구 리다이렉트로 처리하기로 승인돼 라우트째 사라지기 때문입니다. 중복 작업을 피하려 손대지 않았고, 관련 e2e 기대값 수정은 [DOW-1181](/DOW/issues/DOW-1181)에서 [DOW-1159](/DOW/issues/DOW-1159)와 충돌하지 않게 처리합니다.

검증 근거와 남은 한계(실계정 로그인 미검증, 아직 origin/main 미push)는 [DOW-1164](/DOW/issues/DOW-1164)에 정리했습니다."""

print('patch:', json.dumps(call('/api/issues/' + D1157, {'status': 'done', 'comment': body}, 'PATCH'), ensure_ascii=False)[:120])
