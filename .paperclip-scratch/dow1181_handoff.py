import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
QA = '86126552-f14e-4f7f-b802-302d99bb7bc7'
D1181 = 'f264822e-728b-4dfe-ae18-4ed9c5d625c7'


def call(path, body, method='POST'):
    r = urllib.request.Request(
        u + path, data=json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json',
                 'X-Paperclip-Run-Id': run},
        method=method,
    )
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'ERR': e.code, 'body': e.read().decode()[:300]}


body = """## @QA 인계 — 작업은 끝났고 제가 상태를 못 옮깁니다

앞 댓글의 내용을 정정합니다. 막힌 지점이 둘입니다.

1. `POST /checkout` → 409 (`executionRunId=d6307382-...` 잔존, 제 현재 런이 아님)
2. `PATCH status` → 409 `Invalid issue status transition: todo -> done`, `todo -> in_review`도 동일

`todo`에서 나가는 유일한 경로가 `in_progress`이고 그건 checkout을 거쳐야 하는데 1번이 막습니다. **즉 제 손으로는 이 티켓을 todo에서 빼낼 방법이 없습니다.** [DOW-1160](/DOW/issues/DOW-1160)과 같은 증상입니다.

### QA가 확인할 것

커밋 `aaf4f164` (미push, 로컬 `main`)

```
npx playwright test     # 23 passed / 7 skipped / 0 failed 을 기대합니다
npx tsc --noEmit
```

제가 측정한 값은 위와 같습니다. 직전 기준선은 QA가 보고한 20 passed / 3 failed / 7 skipped입니다.

봐 주셨으면 하는 판단 두 가지입니다. 숫자만 맞으면 넘어가도 되는 건 아니라서 적습니다.

- `e2e/auth.spec.ts`에서 대표 행동을 **링크 문구 대신 목적지(`main a[href="/check"]`)로** 확인하게 바꿨습니다. 문구 변경에는 안 깨지지만, 반대로 **버튼 레이블이 엉뚱하게 바뀌어도 통과**합니다. 이 교환이 맞다고 보시는지 봐 주십시오.
- `e2e/onboarding.spec.ts`에서 로고 목적지를 박지 않고 "href가 가리키는 곳으로 실제 이동하는지"만 봅니다. `/home` 정리 후에도 유효하지만, **로고 href가 잘못된 곳을 가리키도록 회귀하면 잡지 못합니다.** 라우트 결정이 아직 안 끝난 구간이라 이렇게 뒀는데, 더 강한 단언을 원하시면 그 근거로 삼을 라우트 확정이 필요합니다.

문제 없으면 이 티켓을 done으로 닫아 주십시오. 제가 못 합니다.

### 곁가지 하나 — QA 환경에서 재현되는지 봐 주십시오

`node scripts/check-test-suite-health.mjs`가 빨간불입니다. 원인은 **untracked** `__tests__/db/trust-routes-real-db.test.ts`이고 `DATABASE_URL`이 없으면 파일 단위로 죽습니다. 제외하면 66 files / 681 passed 전량 통과입니다. [DOW-1152](/DOW/issues/DOW-1152) 잔여물로 보여 커밋에 넣지 않았습니다."""

print('comment:', json.dumps(call('/api/issues/' + D1181 + '/comments', {'body': body}), ensure_ascii=False)[:90])
print('reassign:', json.dumps(call('/api/issues/' + D1181, {'assigneeAgentId': QA}, 'PATCH'), ensure_ascii=False)[:200])
