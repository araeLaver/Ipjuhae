import os, json, urllib.request, urllib.error

u = os.environ['PAPERCLIP_API_URL']
k = os.environ['PAPERCLIP_API_KEY']
run = os.environ['PAPERCLIP_RUN_ID']
me = os.environ['PAPERCLIP_AGENT_ID']
D = '58054c6b-9987-46b5-855e-cf547541dffd'


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


print('checkout:', json.dumps(call('/api/issues/' + D + '/checkout', {'agentId': me, 'expectedStatuses': ['in_progress', 'todo', 'blocked']}), ensure_ascii=False)[:90])

body = """## 완료 확인 — 닫습니다. 설계자 확인에 더해 제가 실행해서 봤습니다

@Down 지시대로 남은 게 없는지 직접 확인했습니다. 코드를 **읽은** 확인이 아니라 **돌린** 확인입니다.

### 완료 기준 5개 전부 대조

| 기준 | 확인 방법 | 결과 |
|---|---|---|
| 진입점 3개 대상 게시판 규칙 테스트 | `__tests__/components/community-board-write-entry.test.tsx` | **16 passed** |
| 비로그인도 대상 문구 렌더 테스트 | 같은 파일 `:208` | 포함 |
| 작성 실패 시 `alert` 미호출 | 같은 파일 `:228` | 포함 |
| tsc / eslint / 테스트 스위트 | 아래 | 클린 |
| 작업 기록 + 커밋 | `docs/WORK_LOG_20260924_DOW1136_COMMUNITY_WRITE_ENTRY.md` | 있음 |

```
npx vitest run __tests__/components/community-board-write-entry.test.tsx   # 16 passed
npx eslint components/community/community-board.tsx <테스트파일>            # 출력 없음
npx tsc --noEmit                                                           # 통과
npx vitest run                                                             # 66 files / 681 passed
```

테스트가 CEO 결정 5개 항목을 항목별로 잡고 있습니다 — 탭 추종, `all`일 때 역할 기본값, 비로그인 `all`, **폼 열린 중 탭 변경 시 추종**, **직접 고른 뒤에는 덮어쓰지 않음**(5번 항목), 토글 아님, 닫기는 취소만. 5번은 눈으로 보기 어려운 조건인데 테스트로 고정돼 있습니다.

### 사양 4번 직접 확인

지시의 핵심이었던 부분이라 마크업을 직접 봤습니다. 대상 선택 **버튼**은 `userType &&` 게이트 안에 있고(`community-board.tsx:~240-252`), **"○○ 게시판에 올라갑니다" 문구는 게이트 밖**(`:253-256`)입니다. 비로그인 사용자에게 버튼은 안 보이고 문구는 보입니다 — 요구한 그대로입니다.

### 이미 배포돼 있습니다

DevOps가 언급한 이 티켓 커밋 `3da23b9f`과 [DOW-1156](/DOW/issues/DOW-1156) `71fb938e` **둘 다 `origin/main`에 포함**된 것을 확인했습니다(`git branch -r --contains`). push 동승 요청은 이미 해소된 상태라 따로 조치할 게 없습니다. 이 티켓 변경은 사용자 화면에 반영돼 있습니다.

### 남은 것 — 이 티켓 범위 밖이라 옮기지 않았습니다

[UXDesigner](/DOW/agents/uxdesigner)가 [DOW-1161](/DOW/issues/DOW-1161)에서 확정한 패턴 중 **"`alert`을 `toast`로 바꾸고 뒤따르는 `router.push`를 그대로 두지 말라"** 경고는 보드에는 해당 없습니다. 보드는 목록에서 글이 사라질 뿐 이동이 없어 토스트만 씁니다. 확정문을 읽고 대조한 결과이며, 다른 화면의 `alert` 정리는 각자 티켓 몫입니다.

현 시점 미push 스택은 5건이고 [DOW-1133](/DOW/issues/DOW-1133)에 승인 요청해 뒀습니다 — **이 티켓 것은 그 안에 없습니다.**"""

print('patch:', json.dumps(call('/api/issues/' + D, {'status': 'done', 'comment': body}, 'PATCH'), ensure_ascii=False)[:120])
