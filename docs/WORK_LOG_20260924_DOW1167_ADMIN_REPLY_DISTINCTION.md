# DOW-1167 — 커뮤니티 상세에서 운영자 답변 구분 (U1)

- 날짜: 2026-09-24
- 담당: UXDesigner
- 상위: DOW-1137 (커뮤니티 전환 이후 UX 전면 검수)
- 커밋: `49390a2b` (미push, CEO 승인 대기)

## 들어가 보니 이미 고쳐져 있었다

티켓의 본체는 "상세 화면이 API가 주는 `author_role`을 버린다"였다. 확인해 보니
DOW-1158 커밋 `62ecffd5`에서 `components/community/author-role-badge.tsx`가 생기며
글 헤더(`community-post-view.tsx:201`)와 댓글(`:278`) 양쪽에 역할 배지가 이미 붙어 있었다.
티켓이 쓰인 시점에는 맞는 지적이었고, 지금은 값이 화면까지 도달한다.

그래서 티켓을 그대로 다시 구현하지 않고, 남은 구멍 두 개만 막았다.

## 1. 배지만으로는 훑을 때 안 보인다

역할 배지는 댓글 메타줄 안의 11px 글자다. 댓글을 스크롤하는 눈에는 걸리지 않는다.
운영자 댓글 카드에만 약한 테두리·바탕(`border-primary/40 bg-primary/5`)을 줬다.

지킨 조건 두 가지:

- **뜻은 배지가 진다.** 색은 보조다. 색을 못 읽어도 '운영자' 글자가 남는다.
- **일반 댓글 마크업은 그대로.** 운영자를 올리려고 질문한 사람을 낮추지 않는다.
  테스트가 일반 댓글의 class 문자열이 종전 그대로인지 직접 검사한다.

## 2. 모르는 `author_role`

값의 출처는 `COALESCE(u.user_type, 'guest')` (`app/api/community/posts/[id]/comments/route.ts:41`).
UI가 아는 값은 `ROLE_LABELS`의 `tenant`/`landlord`/`broker`/`admin` 네 개뿐이다.
`guest`, 앞으로 늘어날 값, `null`은 `roleLabel`이 `null`을 돌려 배지를 만들지 않는다.
이미 안전했지만 그걸 **보호하는 테스트가 없었다.** `'agency'`와 `null`로 렌더해
본문·댓글이 그대로 보이고, 값이 날것으로 찍히지 않고, 운영자 취급도 받지 않는 것을 고정했다.

## 검증

`__tests__/components/community-post-view.test.tsx` — jsdom 실제 렌더, 11건 통과.
소스 grep이 아니라 화면에 보이는 글자와 마크업으로 판정한다.

변경을 되돌린 **대조군에서 새 테스트가 실패하는 것까지 확인**했다
(`expected 'rounded-lg border bg-background p-3' not to be ...`). 통과가 허수가 아니다.
`npx tsc --noEmit` 통과.

## 별건으로 뺀 것 — 앱에는 댓글 목록 자체가 없다 (DOW-1172)

`mobile/src/screens/CommunityPostScreen.tsx`는 본문과 댓글 **개수만** 그린다.
`mobile/src/services/api.ts`에 댓글 조회 함수 자체가 없다. 웹에서 U1을 고쳐도
앱 사용자는 운영자 답변을 **구분 못 하는 게 아니라 아예 못 본다.**
커뮤니티 전환 방침이 웹·앱 병행이므로 구멍이다. DOW-1172로 올리고 배정은 CEO에게 넘겼다.

## 남은 것

커밋이 `components/`를 건드려 DOW-1133 상시 규칙상 운영 런타임 코드다.
단독 push하지 않고 CEO 승인 대기로 DOW-1167을 `in_review` + CEO 배정으로 넘겼다.
미push 스택은 이 1건뿐이라 남의 커밋을 묶어 배포할 위험은 없다.
**승인 전까지 이 변경은 사용자 화면에 없다.**
