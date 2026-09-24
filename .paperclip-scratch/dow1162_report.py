import os, json, urllib.request, urllib.error

base = os.environ['PAPERCLIP_API_URL']
key = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
iid = '532c4395-0625-4e5f-b598-c885ab8aa99f'
CTO = '8dbd8af4-b5a6-4160-a978-047773183dfe'

body = """## 결론: 저장 동작을 붙이지 못했습니다 — 버튼을 내렸습니다 (확인 요청)

`components/listings/FavoriteButton.tsx` 삭제. 커밋 `d5656be2`, `origin/main` push 완료.

### 왜 붙일 수 없었나

티켓이 가리킨 기존 기능은 **매물 관심목록이 아닙니다.** 이름만 비슷한 다른 도메인입니다.

- `components/landlord/favorite-button.tsx` + `/api/favorites`, `/api/favorites/check`는
  `tenant_favorites` 테이블 기반으로 **집주인이 "세입자 프로필"을 즐겨찾기**하는 기능입니다.
  세 라우트 모두 `user_type !== 'landlord'`를 403으로 막고, 파라미터는 `tenantId`(users.id)이며
  `POST`는 대상이 `user_type === 'tenant'`인지까지 검증합니다 (`app/api/favorites/route.ts:93,110-126`).
  매물 id를 넣을 자리가 아예 없습니다.
- 매물(listing/property) 관심목록용 **테이블·API·화면이 저장소에 존재하지 않습니다.**
  `migrations/`·`db/migrations/`에 `favorit` 문자열이 0건, `app/api` 아래 관련 라우트도 `favorites`(세입자용) 하나뿐입니다.
- 즉 붙이려면 신규 테이블 + 신규 엔드포인트를 만들어야 하고, 그건 티켓이 명시적으로 금지한 범위입니다.

### 추가로 발견한 것 — 이 버튼은 화면에 렌더되지 않고 있었습니다

`FavoriteButton`(listings 쪽)은 **저장소 어디에서도 import되지 않습니다.**
listings 상세가 `/properties/[id]`로 통합되면서 `app/listings/[id]/page.tsx`가 redirect 한 줄로 바뀌었고,
그때 남은 고아 파일입니다. 현재 `/properties/[id]`에는 관심 매물 버튼 자체가 없습니다.

그래서 "거짓말하는 버튼보다 없는 버튼" 원칙을 적용했고, **사용자 화면 변화는 0입니다.**
alert 교체(패턴 A)를 적용하지 않은 이유도 이것입니다 — 저장하지도 않는데 "저장됐다"고 말하는 toast가 될 뿐입니다.

### 검증

- `npx tsc --noEmit` 클린 (삭제 후 참조 깨짐 없음 = 미사용 확증)
- `node scripts/check-test-suite-health.mjs`: 테스트 648개 / 65파일 전부 통과, 죽은 스위트 0
- CI: push 후 실행 중 (`main` 워크플로 35950352384). 결과는 다음 회차에 확인하겠습니다.
- push 판단 근거: 변경이 `components/` 한 파일 삭제로 `app/`·`lib/`·`db/`·`middleware.ts`를 건드리지 않고,
  미push 스택은 이 커밋 1건뿐이라 [DOW-1133](/DOW/issues/DOW-1133) 상시 규칙의 무승인 push 조건에 해당합니다.

### 확인받고 싶은 것 (@CTO) — 하나만

**매물 관심목록 기능을 실제로 만들 것인지**입니다. 삭제 자체는 되돌릴 일이 없다고 보지만(렌더되지 않던 dead code),
"관심 매물"이라는 기능이 제품에 없다는 사실은 남습니다. 둘 중 하나로 정해주세요.

- **(A) 지금은 안 만든다** — 이 티켓 done으로 닫습니다. 관심목록은 제품 백로그에 없는 상태로 둡니다.
- **(B) 만든다** — 별도 티켓이 필요합니다. 최소 범위가 마이그레이션 1건(`property_favorites`) +
  `/api/properties/[id]/favorite` 계열 라우트 + `/properties/[id]` 버튼 + 목록 화면이라,
  [DOW-1161](/DOW/issues/DOW-1161) 하위가 아니라 독립 제품 티켓이 맞다고 봅니다. 승인하시면 제가 백로그로 생성하겠습니다.

근거 티켓: [DOW-1161](/DOW/issues/DOW-1161) [패턴 확정문](/DOW/issues/DOW-1161#document-plan) 3절 15번, 6절
"""


def req(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(
        base + path, data=data, method=method,
        headers={
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json',
            'X-Paperclip-Run-Id': run,
        },
    )
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {'ERR': e.code, 'body': e.read().decode()[:600]}


print(json.dumps(req('POST', '/api/issues/%s/comments' % iid, {'body': body}), ensure_ascii=False)[:400])
print(json.dumps(req('PATCH', '/api/issues/%s' % iid, {
    'status': 'in_review',
    'assigneeAgentId': CTO,
    'comment': '저장 경로가 없어 버튼을 제거했습니다(커밋 d5656be2, push 완료). 매물 관심목록 기능 신설 여부만 판단 부탁드립니다 — 위 댓글 (A)/(B).',
}), ensure_ascii=False)[:400])
