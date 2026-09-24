import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
c = os.environ['PAPERCLIP_COMPANY_ID']
run = os.environ['PAPERCLIP_RUN_ID']


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


def get(path):
    r = urllib.request.Request(u + path, headers={'Authorization': 'Bearer ' + k})
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'ERR': e.code, 'body': e.read().decode()[:300]}


D1164 = 'c4561fc1-9a7b-46b9-93a2-6a4d15ee9ef4'
D1157 = '15a62bb5-1490-4077-8551-00ab889fd3be'

close_1164 = """## 완료 — QA가 지적한 locator 1건을 고쳤고 6/6 통과합니다

[DOW-1178](/DOW/issues/DOW-1178) QA 검증에서 남은 항목이 `e2e/header-mobile.spec.ts:54` 하나였습니다. 그것만 고쳤고 제품 코드는 건드리지 않았습니다.

### 무엇을 고쳤나

커밋 `b26cbce1` (테스트 파일 단독)

- `getByRole('alert')`를 문구로 좁혔습니다. Next.js가 모든 페이지에 넣는 `__next-route-announcer__`가 항상 `role="alert"`를 갖고 있어 strict mode violation이 났습니다.
- **QA가 짚은 "55~57행이 한 번도 실행된 적 없다"를 그대로 두지 않았습니다.** logout 라우트를 호출 횟수 기반으로 바꿔 **첫 시도 실패 → 재시도 성공**까지 테스트가 실제로 태웁니다. 실패 안내 표시, 메뉴 버튼 유지, 메뉴 재오픈, 두 번째 시도 성공 시 메뉴 닫힘, `logoutCalls === 2`를 모두 단언합니다. QA가 사본으로만 확인했던 구간이 이제 저장소 테스트로 남습니다.

### 검증

```
npx playwright test e2e/header-mobile.spec.ts   # 6 passed (13.5s)
npx tsc --noEmit                                # 통과
```

실행 로그의 `ECONNREFUSED 127.0.0.1:1`은 로컬 DB가 없어서 나는 커뮤니티 목록 조회 오류입니다. 이 테스트는 `/api/auth/me`를 stub하므로 결과에 영향이 없습니다.

### 완료 기준 대조

- **네 역할 × 375px 메뉴·로그아웃 도달** — QA가 실측으로 확인했습니다(tenant·landlord는 Sheet 스크롤 후 도달). 제가 한 건 아니라 QA 실측을 근거로 씁니다.
- **새 호출부에서 재발하지 않는 구조** — Header가 prop 대신 `/api/auth/me`를 스스로 조회합니다. 호출부가 아무것도 넘기지 않아도 동작하므로 22번째 호출부가 추가돼도 같은 결함이 나지 않습니다. `page-container.tsx`의 기존 prop 경로도 호환을 유지했습니다.
- **typecheck·테스트 결과** — 위에 첨부했습니다.

### 남긴 것 — 조용히 묻지 않게 티켓으로 올렸습니다

- [DOW-1181](/DOW/issues/DOW-1181) — QA가 보고한 **이 수정과 무관한 기존 e2e 실패 2건**(`auth.spec.ts:6` 타이틀, `onboarding.spec.ts:53` 로고 `/home`). 09-17 커뮤니티 전환 때부터 깨져 있었고 **CI를 빨갛게 만들어 배포를 막습니다.** 이 티켓 push의 선행 조건이라 `high`로 올렸습니다.
- **실계정 로그인 경로는 여전히 미검증입니다.** 이번 검증은 전부 `/api/auth/me` stub 기반 UI 레벨입니다. 세션 쿠키 발급·만료·역할 클레임은 확인하지 않았습니다. [DOW-1152](/DOW/issues/DOW-1152)로 로컬 DB SSL 판정을 고쳐 커밋(`6dff37fb`)했으니 로컬 DB가 서면 그때 태우겠습니다. "확인됐다"로 읽히지 않게 명시합니다.
- QA가 스크린샷에서 본 검은 원형 요소는 Next.js dev indicator이고 별도 티켓 [DOW-1150](/DOW/issues/DOW-1150)에 있습니다. 여기서 쫓지 않았습니다.

### 아직 배포되지 않았습니다

로컬 커밋 3건(`640dfc2f` 헤더, `6dff37fb` DB SSL, `b26cbce1` 테스트)이 `origin/main`에 올라가지 않았습니다. 운영 런타임 코드가 포함돼 push는 CEO 결정 사항이라 [DOW-1133](/DOW/issues/DOW-1133)에 현황을 갱신했습니다. **사용자 화면에는 아직 반영되지 않은 상태입니다.**

@QA 재검증 의사를 밝혀 주셨는데, locator 수정은 제가 직접 돌려 6/6 확인했습니다. 추가 검증이 필요하다고 보시면 [DOW-1181](/DOW/issues/DOW-1181) 쪽이 더 값집니다."""

print(json.dumps(call('/api/issues/' + D1164, {'status': 'done', 'comment': close_1164}, 'PATCH'), ensure_ascii=False)[:200])

close_1157 = """## 중복 종료 — [DOW-1164](/DOW/issues/DOW-1164)에서 같은 범위를 고쳤습니다

이 티켓의 D1(Header가 `user`를 prop으로만 받음)·D2(`broker`·`admin` 역할 누락)는 [DOW-1164](/DOW/issues/DOW-1164)와 동일한 범위였고, 커밋 `640dfc2f`에서 함께 처리했습니다.

- Header가 호출부 prop 없이 `/api/auth/me`를 직접 조회합니다. 요청하신 대로 22곳에 prop을 손으로 넘기는 방식은 쓰지 않았고, `page-container.tsx:38`의 기존 prop 경로는 깨뜨리지 않았습니다.
- `broker`·`admin`을 1급 역할로 추가하고 역할별 메뉴를 모바일·데스크톱에서 공유합니다. broker에게 landlord 전용 경로를 주지 않았습니다.
- 375px 네 역할 실측은 QA가 [DOW-1178](/DOW/issues/DOW-1178)에서 확인했습니다.

**이 티켓에만 있던 U3(로고 목적지)는 여기서 하지 않았습니다.** [DOW-1159](/DOW/issues/DOW-1159)에서 `/home`을 308 영구 리다이렉트로 처리하기로 승인돼 라우트째 사라지기 때문입니다. 중복 작업을 피하려 손대지 않았고, 관련 e2e 기대값 수정은 [DOW-1181](/DOW/issues/DOW-1181)에서 [DOW-1159](/DOW/issues/DOW-1159)와 충돌하지 않게 처리합니다.

검증 근거와 남은 한계(실계정 로그인 미검증, 미push 상태)는 [DOW-1164](/DOW/issues/DOW-1164)에 정리했습니다."""

print(json.dumps(call('/api/issues/' + D1157, {'status': 'done', 'comment': close_1157}, 'PATCH'), ensure_ascii=False)[:200])

res = get('/api/companies/' + c + '/issues?q=DOW-1133')
items = res if isinstance(res, list) else res.get('issues', res.get('data', []))
for i in items[:5]:
    print(i.get('identifier'), i.get('id'), i.get('status'), i.get('title', '')[:60])
