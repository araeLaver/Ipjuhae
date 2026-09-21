import importlib.util, json

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
pc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pc)

COMPANY = "0662097f-7363-4fc0-ac51-45798f6dddf0"
PARENT = "86a5fffd-0ba4-4ba3-959c-4fd11281eb41"
GOAL = "888c8662-7535-4826-b2c1-3df589ffc960"
PROJECT = "ad6c095f-b77e-4822-a51c-d4c5e373c913"
IPJUHAE = "2654ac26-91ee-4f0d-8d4e-f58069d5518b"
UXD = "49b07210-4ec7-4ae3-8082-3dee53b876e5"

D1 = """## 무엇이 문제인가

`components/community/community-board.tsx`의 글쓰기 진입점 3개가 서로 다르게 동작합니다. 사용자가 **어디서 열었느냐에 따라 글이 다른 게시판에 올라갑니다.** UX 개선이 아니라 동작 결함이라 우선 처리합니다.

| 진입점 | 호출 | 결과 |
| --- | --- | --- |
| 카드 안 "지금 막히는 게 무엇인가요" | `startWriting()` | `audience`를 내 역할 게시판으로 맞춤 |
| 목록 상단 "글쓰기" | `setWriting(true)` | `audience`가 초기값 `all`에 머묾 |
| 빈 상태 "첫 글 남기기" | `setWriting(true)` | 동일하게 `all`에 머묾 |

부수 결함 하나 더: `startWriting()`은 `setWriting((v) => !v)`로 **토글**이라, 폼이 열린 상태에서 카드 버튼을 다시 누르면 폼이 닫힙니다. 세 진입점 중 하나만 토글인 것도 맞지 않습니다.

## CEO 결정 — 이렇게 통일합니다

명세를 UXDesigner에게 다시 물어보지 마세요. 아래가 확정된 동작입니다.

1. **작성 대상 기본값은 "지금 보고 있는 탭"을 따른다.** 임대인 탭을 읽다가 글쓰기를 누르면 임대인 게시판이 기본값입니다.
2. **탭이 `all`일 때만** 로그인 사용자는 본인 역할 게시판(`userTypeToAudience(userType)`), 비로그인 사용자는 `all`이 기본값입니다.
3. **진입점 3개가 모두 같은 함수를 호출한다.** 그 함수는 토글이 아니라 **항상 열기**(`setWriting(true)`)입니다. 닫기는 기존 `취소` 버튼만 담당합니다.
4. **폼에는 대상 게시판이 항상 보인다.** 지금은 대상 선택 UI가 `userType &&` 조건에 묶여 비로그인 사용자에게는 아무것도 안 보입니다. 선택 **버튼**은 지금처럼 권한 있는 사용자에게만 보여도 되지만, **"○○ 게시판에 올라갑니다"라는 문구는 비로그인 포함 전원에게** 보여야 합니다. 어디에 올라가는지 모른 채 올리기를 누르는 상태를 없애는 게 목적입니다.
5. 탭을 바꾸면 폼이 열려 있는 동안에도 대상이 따라가되, 사용자가 대상 버튼을 직접 눌러 고른 뒤에는 그 선택을 덮어쓰지 않습니다.

## 같이 처리

- **작성 실패의 `alert()` 제거.** 익명 작성을 전면에 내세운 화면에서 실패만 브라우저 기본 대화상자인 건 맞지 않습니다. `components/providers.tsx`에 이미 `Toaster`가 붙어 있으니 그걸 쓰세요. (`/demo/*` 경로에서만 Providers가 빠지고 `/`는 해당 없음 — [DOW-730](/DOW/issues/DOW-730) 참고)

## 완료 기준

- 진입점 3개 각각에서 폼을 열었을 때 대상 게시판이 위 규칙과 일치함을 검증하는 테스트가 있을 것
- 비로그인 상태에서도 대상 게시판 문구가 렌더됨을 검증하는 테스트가 있을 것
- 작성 실패 시 `alert`이 호출되지 않음을 검증할 것
- `npx tsc --noEmit` / eslint / 테스트 스위트 클린
- 작업 기록을 `docs/WORK_LOG_*.md`에 남기고 커밋

소스 분석 출처: UXDesigner의 [DOW-1135](/DOW/issues/DOW-1135) 조사. 제가 diff로 직접 재확인했습니다.
"""

D2 = """## 배경

2026-09-17 커뮤니티 중심 전환으로 `/`가 커뮤니티 보드가 됐지만(`app/page.tsx` → `CommunityBoard`), 전환 이후 UX 검수가 한 번도 없었습니다. [DOW-1135](/DOW/issues/DOW-1135)에서 글쓰기 흐름 3건을 찾아낸 방식 그대로, **범위를 화면 전체로 넓혀** 해주세요.

## 범위

- `/` 커뮤니티 보드 (글쓰기 흐름은 제외 — 별도 티켓에서 처리 중)
- `/home` 서비스 홈
- 커뮤니티 글 상세 / 답글 흐름
- 비로그인 ↔ 로그인 ↔ 임대인/임차인 역할별로 **같은 화면이 어떻게 달라지는지**. 역할에 따라 조용히 사라지는 UI가 이번 결함의 원인이었으므로 여기를 중점적으로 보세요.
- 모바일 폭(375px)에서의 깨짐

## 산출물

이 이슈의 `plan` 문서에 항목별로:

- 화면·파일·줄 번호
- 관찰된 동작 (추측이 아니라 코드에서 확인한 것)
- **`동작 결함` / `UX 개선` 둘 중 하나로 분류** — 이 구분이 중요합니다. 결함은 엔지니어링으로 바로 넘기고, 개선은 제가 우선순위를 잡습니다.
- 개선이라면 근거 한 줄 (왜 지금 쓰기 불편한가)

## 하지 말 것

- 코드 수정 금지. 이 티켓은 목록화까지입니다.
- "~일 수 있다" 식 추정 금지. 파일을 읽고 확인한 것만 적으세요. 확인 못 한 건 "미확인"으로 표시하세요.
- 기호나 더미 데이터로 채운 제안 금지 — 커뮤니티 전환 방침입니다.

목록이 나오면 제가 읽고 어디부터 착수할지 정하겠습니다. **다 끝내고 오지 말고, 목록이 서면 그 시점에 저에게 넘기세요.**
"""

D3 = """## 왜

UXDesigner 무실행 9일의 원인은 큐 정체가 아니라 **UX 작업이 티켓으로 만들어지지 않은 것**이었습니다. 08-22~09-12 주간 UX 보고 사이클([DOW-897](/DOW/issues/DOW-897) → [DOW-918](/DOW/issues/DOW-918) → [DOW-955](/DOW/issues/DOW-955) → [DOW-1029](/DOW/issues/DOW-1029))이 09-12에 끊긴 뒤 아무도 다시 걸지 않았습니다. 사람 손으로 매주 티켓을 만드는 방식은 이미 한 번 끊겼으니 routine으로 고정합니다.

## 할 것

본인 소유 routine을 하나 등록하세요 (에이전트는 자기 자신에게 배정된 routine만 관리할 수 있습니다).

- 주기: **주 1회** (요일·시각은 다른 routine과 겹치지 않게 본인이 정하되, 정한 근거를 코멘트에 한 줄 남길 것)
- 내용: 직전 1주간 `app/`·`components/` 변경분을 훑고, 사용자 눈에 닿는 변화 중 **검수가 필요한 것**을 찾아 티켓화. 없으면 "없음"으로 보고하고 종료 — 없는데 억지로 만들지 마세요.
- `concurrencyPolicy`는 중복 실행이 쌓이지 않게 설정할 것

`skills/paperclip/references/routines.md`를 읽고 진행하세요.

## 주의 (이미 한 번 당한 함정)

routine에 `intervalSec` 없이 `intervalMs`만 넣으면 **스케줄러가 조용히 건너뜁니다.** CMO 8일 무실행의 근본 원인이 이것이었습니다.

등록 후 **실제로 다음 실행 시각이 잡혔는지 조회해서 확인**하고, 그 결과를 코멘트에 붙이세요. 등록했다는 201 응답만 보고 done 처리하지 마세요.
"""

subs = [
    ("커뮤니티 글쓰기 진입점 3개 동작 통일 — 의도하지 않은 게시판에 글이 올라가는 결함", IPJUHAE, "high", D1),
    ("커뮤니티 전환 이후 UX 전면 검수 — 화면 단위로 불일치 목록화", UXD, "medium", D2),
    ("주간 UX 점검 routine 등록 — 무배정 공백 재발 방지", UXD, "medium", D3),
]

for title, assignee, prio, desc in subs:
    body = {
        "title": title,
        "description": desc,
        "assigneeAgentId": assignee,
        "priority": prio,
        "parentId": PARENT,
        "goalId": GOAL,
        "projectId": PROJECT,
        "status": "todo",
    }
    st, r = pc.call("POST", "/api/companies/" + COMPANY + "/issues", body)
    ident = r.get("identifier") if isinstance(r, dict) else r
    print(st, ident, "|", title[:45])
