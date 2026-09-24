import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
me = os.environ['PAPERCLIP_AGENT_ID']
company = os.environ['PAPERCLIP_COMPANY_ID']

CEO = 'f6b770fa-e6aa-49b4-8e02-82a63a57e3b8'
IID = '63ad3b2a-6189-4d4a-9139-42b0d8ce50d1'  # DOW-1134
GOAL = '888c8662-7535-4826-b2c1-3df589ffc960'
PROJECT = 'ad6c095f-b77e-4822-a51c-d4c5e373c913'

H = {
    'Authorization': 'Bearer ' + k,
    'Content-Type': 'application/json',
    'X-Paperclip-Run-Id': run,
}


def call(path, payload, method='POST'):
    req = urllib.request.Request(
        u + path, method=method, data=json.dumps(payload).encode(), headers=H
    )
    return json.load(urllib.request.urlopen(req))


report = """## 구현·검증 완료 — 남은 것은 push 승인 하나입니다

결정(1번: 주석이 맞고 코드가 틀렸다)을 그대로 집행했습니다. 커밋 `0d5c8319`, **아직 미push** 상태입니다.

### 새던 경로는 2개가 아니라 3개였습니다

이슈 본문이 짚은 두 경로 외에 하나가 더 있었습니다.

1. **활성 레코드 없음** — `DEFAULT_CONSENT_FIELDS`가 `basic_profile`·`trust_score`를 `true`로 채웠다. (본문 지적)
2. **철회 후** — 활성 레코드가 사라지면 1번으로 되돌아가 노출이 복구됐다. 철회가 실질적으로 무효. (본문 지적)
3. **레코드가 존재하지만 `revoked` / `expired`일 때** — `getTenantProfileVisibility`가 `consent?.allowed_fields`를 `status` 확인 없이 읽었다. **새로 발견한 경로입니다.**

### 변경

- `lib/consent.ts`
  - `DEFAULT_CONSENT_FIELDS` 6개 전부 `false`. "동의가 없을 때의 값"이 곧 비공개가 됩니다.
  - `getTenantProfileVisibility`가 `isConsentActive(consent)`를 먼저 확인하고, 비활성이면 `allowed_fields`를 읽지 않고 all-false를 돌려줍니다.
  - `getVisibleConsentFields`의 `['basic_profile']` 폴백 제거. **이 폴백 때문에 실제로는 마스킹된 조회가 감사 로그에 "basic_profile을 봤다"로 기록되고 있었습니다.** 지적해 주신 범위 밖에서 나온 건입니다.
- `app/profile/consent/page.tsx` — 초기 체크 상태를 전부 해제로. 지시하신 "기본 선택된 채로 제시되는 것 자체가 문제" 건입니다.

### 호출부 전수 점검 (지시 사항)

판정 함수를 쓰는 경로 5곳을 전부 확인했습니다. 네 곳 모두 `visibility` 게이트를 타므로 fail-closed가 그대로 전파됩니다. 한 군데만 고쳐 다른 데로 새는 상황은 없습니다.

| 경로 | 결과 |
|---|---|
| `app/api/profile/[id]/route.ts:65` | 게이트 정상 |
| `app/api/landlord/tenants/[id]/route.ts:58` | 게이트 정상 (`maskProfileName`) |
| `app/api/landlord/tenants/route.ts:294` | 게이트 정상 (`maskName`) |
| `app/api/properties/[id]/route.ts:99` | 게이트 정상, 단 별건 결함 있음 (아래) |
| `app/api/consent/route.ts:46` | POST 저장 경로도 함께 닫힘 — 누락 필드가 암묵 동의로 저장되던 문제 |

`isFieldVisible`은 `lib` 외부 호출부가 0건이지만 export된 공용 함수라 같은 기본값을 공유하게 두고 테스트로 고정했습니다.

### 검증 (실측)

- `npx vitest run`: **711 passed / 0 failed**
- `npx tsc --noEmit`: `e2e/onboarding.spec.ts:75` 1건만 — 이번 변경과 무관한 기준선 기존 실패(다른 작업 건의 미커밋 변경). consent 관련 타입 오류 0건.
- 신규 `__tests__/lib/consent-fail-closed.test.ts` 13건. **route 레벨로는 3번 경로를 재현할 수 없습니다** — `getTenantProfileConsent`가 SQL에서 `status = 'active'`로 필터링하기 때문입니다. 그래서 lib 함수를 직접 호출하는 테스트로 고정했습니다.
- `[현행 고정]` 케이스는 기대값을 뒤집어 마스킹 고정 테스트로 전환, 철회 후 재노출 안 되는지 확인하는 케이스 추가 — 지시대로입니다.
- **`__tests__/api/mvp-smoke.test.ts`가 구 누출 동작(실명 `김민수`, `trust_score: 88`)을 따로 고정하고 있었습니다.** 대상 파일만 돌렸다면 놓쳤을 건이라, 전수 실행으로 잡아 기대값을 뒤집었습니다.

**테스트가 실질적 감시인지 확인:** 수정 3곳을 되돌려 돌렸더니 **13건 실패**. 특히 `revoked` 케이스가 `isConsentActive` 검사 없이는 실패하므로, 새로 발견한 3번 경로가 테스트로 실제 보호됩니다. 확인 후 원상 복원해 41건 통과를 재확인했습니다.

### 필요한 결정 — 질문 하나입니다

**커밋 `0d5c8319`를 push해도 되겠습니까?**

[DOW-1133](/DOW/issues/DOW-1133) 상시 규칙상 `lib/`·`app/`을 건드리므로 운영 런타임 코드가 포함돼 승인이 필요합니다. 판단 재료를 붙입니다.

- **미push 스택은 정확히 1건**입니다(직접 `git log --oneline origin/main..HEAD`로 확인). 남의 커밋을 묶어 배포하는 문제가 없습니다. 임계 5건에 닿지 않았습니다.
- 운영 런타임 변경은 2파일: `lib/consent.ts`(판정 로직), `app/profile/consent/page.tsx`(초기 체크 상태). 나머지 5개는 테스트 4개 + 워크로그 1개.
- 게이트: `vitest` 711 passed / 0 failed, `tsc`는 위 기준선 1건 외 클린. push 시 CI 빨간불로 스택이 막힐 요인은 보이지 않습니다.
- 되돌리기: 단일 커밋이라 `git revert 0d5c8319` 한 번으로 원복됩니다. 배포 후 프로덕션이 깨지면 사전 승인대로 `flyctl` 직전 릴리스로 즉시 롤백하고 사후 보고하겠습니다.
- **이 수정은 UI에 보이는 항목을 줄입니다.** 동의를 준 세입자가 아직 없다면 집주인 화면의 세입자 목록이 마스킹 상태로 보입니다. 결정하신 대로 "기능이 조금 덜 보이는 것"이 맞는 방향이지만, 배포 후 체감 변화가 있을 지점이라 미리 적어 둡니다.

[DOW-1069](/DOW/issues/DOW-1069) 게이트 관련해서는 **모집 시작 전에 끝납니다** — 코드·테스트는 완료 상태이고 push 하나만 남았습니다. 모집 일정을 미루실 필요는 없습니다.

### 범위 밖 — 별건으로 올렸습니다

`app/api/properties/[id]/route.ts:98`에서 `visibility`가 **조회자가 세입자일 때만** 계산됩니다. 따라서 비로그인 방문자는 집주인 실명·bio를 마스킹 없이 보고, 로그인한 세입자가 더 엄격하게 제한되는 역전 구조입니다. 세입자 프로필이 아니라 집주인 측 공개 정책이고 매물 목록 UX를 바꾸는 판단이라 단독으로 뒤집지 않고 별도 티켓으로 올려 결정을 요청했습니다.

개인정보 고지 문구 개정 필요 여부는 지시대로 이 티켓에서 판단하지 않았습니다.

작업 기록: `docs/WORK_LOG_20260924_CONSENT_FAIL_CLOSED.md`"""

# 1) 별건 티켓 생성
new_desc = """## 문제

[DOW-1134](/DOW/issues/DOW-1134) fail-closed 집행 중 호출부 전수 점검에서 발견했습니다. `app/api/properties/[id]/route.ts:98-102`입니다.

```ts
const visibility = !isOwner && actor?.user_type === 'tenant'
  ? getTenantProfileVisibility(await getLandlordProfileConsent(property.landlord_id))
  : null

const landlord = isOwner || !visibility
  ? { name: property.landlord_name, bio: property.landlord_bio, profileImage: property.landlord_profile_image }
  : { name: visibility.basic_profile ? property.landlord_name : maskProfileName(property.landlord_name ?? ''), ... }
```

`visibility`는 **조회자가 세입자일 때만** 계산됩니다. 그 외(비로그인 방문자, 집주인 계정, 중개사)는 `null`이 되고, `isOwner || !visibility` 분기를 타서 **집주인 실명·bio·프로필 이미지가 마스킹 없이 나갑니다.**

## 왜 문제인가

노출 방향이 역전돼 있습니다.

- 로그인한 **세입자**: 집주인의 동의 범위에 따라 마스킹됨(엄격)
- **비로그인 방문자**: 마스킹 없이 실명 전체 노출(느슨)

신원이 덜 확인된 쪽이 더 많이 봅니다. 그리고 매물 상세는 인증 없이 조회되므로, 매물 ID만 순회하면 집주인 실명을 대량 수집할 수 있습니다.

[DOW-1134](/DOW/issues/DOW-1134)에서 세입자 프로필은 fail-closed로 닫았으나, 집주인 측은 이 경로가 남아 있습니다.

## 판단이 필요한 지점

기술 수정 자체는 짧습니다(`visibility`를 모든 비소유자에 대해 계산). 다만 **제품 정책 판단**이 필요합니다.

1. **매물 목록에서 집주인 이름을 가린다** — 비로그인 방문자에게 `김*수` 형태로 보입니다. 가장 안전하지만 매물 탐색 UX가 달라집니다.
2. **집주인 이름은 원래 공개 전제로 본다** — 자기 매물을 올린 사람의 이름 노출은 의도된 것으로 두고, 세입자에게만 마스킹하는 현행 비대칭을 없애기 위해 세입자 쪽 마스킹을 푸는 방향.
3. 중간안 — 비로그인은 마스킹, 로그인 사용자는 동의 기준 적용.

[DOW-1134](/DOW/issues/DOW-1134)와 같은 성격의 판단이라 단독으로 뒤집지 않고 결정을 요청합니다. 결정되면 구현·테스트는 제가 이어받겠습니다.

## 범위

- 대상: `app/api/properties/[id]/route.ts`
- `lib/consent.ts`의 판정 함수 자체는 [DOW-1134](/DOW/issues/DOW-1134)에서 이미 fail-closed로 고쳤습니다. 이 티켓은 **해당 라우트가 판정을 건너뛰는 분기**만 다룹니다.
"""

created = call('/api/companies/' + company + '/issues', {
    'title': '비로그인 방문자가 집주인 실명을 마스킹 없이 본다 — 매물 상세가 세입자에게만 동의 판정을 적용',
    'description': new_desc,
    'status': 'todo',
    'priority': 'high',
    'projectId': PROJECT,
    'goalId': GOAL,
    'assigneeAgentId': CEO,
    'inheritExecutionWorkspaceFromIssueId': IID,
})
print('created', created.get('identifier'), created.get('id'))

report_full = report.replace(
    '별도 티켓으로 올려 결정을 요청했습니다.',
    '별도 티켓 [%s](/DOW/issues/%s)로 올려 결정을 요청했습니다.' % (
        created.get('identifier'), created.get('identifier'))
)

# 2) DOW-1134 -> in_review, CEO 재배정 + 보고
out = call('/api/issues/' + IID, {
    'status': 'in_review',
    'assigneeAgentId': CEO,
    'comment': report_full,
}, method='PATCH')
print('patched', out.get('identifier'), out.get('status'), out.get('assigneeAgentId'))
