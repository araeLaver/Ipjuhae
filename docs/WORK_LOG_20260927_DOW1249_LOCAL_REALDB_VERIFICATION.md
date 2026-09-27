# DOW-1249 — 프로덕션에 데이터가 없어 판정 불가였던 2건을 같은 revision 로컬 실DB로 닫음

2026-09-27 (KST). 담당: 입주해 에이전트.

## 무엇이 남아 있었나

[DOW-1249](/DOW/issues/DOW-1249) 실측 7항목 중 5건은 프로덕션에서 통과했고, 2건이 **판정 불가**로 남아 있었다.

| 항목 | 왜 판정 불가였나 |
|---|---|
| (A) 댓글 payload 키 | 프로덕션 글 18건 전부 `comment_count = 0`. `{"comments": []}` 를 받고 "`author_name` 키가 없다"고 쓰면 거짓 통과다 — 빈 배열은 항목 키에 대해 아무것도 증명하지 않는다 |
| (B) 일반 사용자 `익명` 표시 | 프로덕션 글 18건 전부 `author_role = "admin"`. 일반 사용자 글이 하나도 없어 화면에 렌더될 대상이 없다 |

둘 다 **내 능력의 한계가 아니라 대상 데이터의 부재**였다. 프로덕션에 글·댓글을 새로 만들어 실측하는 것은 라이브 커뮤니티에 사용자 눈에 보이는 데이터를 넣는 일이라 승인 없이 하지 않았다.

## 어떻게 닫았나

프로덕션과 **같은 코드**를 로컬 실DB로 띄우고, 실명이 들어간 계정이 쓴 글·댓글을 넣어 응답을 직접 받았다.

### 같은 코드임을 먼저 확정

```
git diff --stat eb3033e3..HEAD -- app/api/community lib/community.ts components/community mobile/src
  mobile/src/services/api.ts | 4 ++--   (주석 2줄만, 런타임 변화 없음)
```

`eb3033e3` 이 배포된 revision 이고, 커뮤니티 웹 런타임 코드(API 3개 라우트·`lib/community.ts`·`components/community/`)는 **HEAD 와 완전히 같다.** 그래서 로컬 실측 결과가 프로덕션 응답과 갈라질 경로가 없다.

### 실측 환경

- 로컬 postgres `ipjuhae_e2e` 를 035~044 까지 올림 (`scripts/qa/apply_local_migrations.mjs`).
  043·044 가 `community_comments.author_hash`·`hidden_at` 을 추가하는데, 배포 라우트가 그 컬럼을 참조하므로 이걸 빼면 실측 자체가 불가능하다.
- fixture: 임차인·임대인·운영자 계정에 `profiles.name` 을 채우고(= DOW-1236 누출 대상 값 자체), 임차인 글 1건·운영자 글 1건, 댓글 4건 (`scripts/qa/seed_community_anonymity_fixture.mjs`).
- 서버: `scripts/qa/dev_server.mjs` — `next dev` 바이너리 실행이 막힌 셸에서도 **진짜 HTTP 응답**을 받기 위해 Next 를 node 로 직접 띄운다. 라우트 핸들러를 import 해서 부르는 방식은 요청 컨텍스트가 없어 실제 응답과 갈라진다.

### 판정을 두 겹으로 둔 이유

키 부재만 보면 **다른 키에 이름이 실려 나가는 경우**를 놓친다. 그래서 fixture 이름을 표식 문자열(`QA표식…`)로 넣고, 응답 본문 전체에서 그 문자열이 0회인지도 같이 봤다.

## 결과

### (A) 댓글 payload — 실제 3행으로 통과

```
GET /api/community/posts/{임차인글}/comments → 200
  item 키(전 행 합집합): ["author_role","body","created_at","id"]
  author_role 값 분포: ["tenant","landlord","admin"]
  댓글 행 수: 3
  실명 표식 출현: 0종
```

역할이 다른 3명이 쓴 댓글이 실제로 실려 나온 응답에서 `author_name`·`author_id`·`author_hash` 가 **없다.** 운영자 글의 댓글(1행)도 같다.

### (B) 표시 이름 — 브라우저 노드 단위로 통과

```
임차인 글  작성자 메타 span: ["전체","익명"]        강조 배지: []
운영자 글  작성자 메타 span: ["전체","입주해","운영자"]  강조 배지: ["운영자"]  메타 줄 '운영자' 1회
화면 전체 실명 표식 출현: 0종
```

일반 사용자는 `익명`, 운영자는 이름 `입주해` + 배지 `운영자` 가 **따로** 붙는다. `innerText` 정규식이 아니라 span 별 텍스트로 판정했다 — `innerText` 는 두 노드를 공백으로 이어 `입주해 운영자` 로 만들어 정상 화면과 결함을 구분하지 못한다(이전에 거짓 FAIL 을 냈다).

### 프로브가 회귀를 실제로 잡는지 — 대조군으로 확인

댓글 라우트 SELECT 에 `c.author_id, pr.name AS author_name` 을 되돌려 넣고 같은 프로브를 돌렸다.

```
FAIL 4건
  - 댓글(임차인 글): 금지 키 노출 ["author_id","author_name"]
  - 댓글(임차인 글): 응답 본문에 계정 실명 표식이 실려 나옴 (3종)
  - 댓글(운영자 글): 금지 키 노출 ["author_id","author_name"]
  - 댓글(운영자 글): 응답 본문에 계정 실명 표식이 실려 나옴 (1종)
```

키·표식 양쪽으로 잡았다. 확인 후 `git checkout` 으로 되돌렸고 재실행 PASS 를 확인했다. 대조군 없는 초록은 근거가 아니다.

## 따로 봐야 할 것 — `author_role` 은 지금도 전량 실려 나간다

측정으로 확정됐다. 일반 사용자 글의 payload 에 `author_role: "tenant"` 가, 댓글에는 `["tenant","landlord","admin"]` 이 그대로 실린다.

그런데 **화면은 이 값을 이미 버린다.** `components/community/author-role-badge.tsx:14` 가 `role !== 'admin'` 이면 `null` 을 반환하고, 나머지 소비자도 전부 `=== 'admin'` / `!== 'admin'` 비교뿐이다 (`community-board.tsx:101,114`, `community-post-view.tsx:301`, `lib/home-content.ts:118`, `mobile/src/services/api.ts` 는 매핑만).

즉 익명 게시판 응답이 **UI 소비처가 없는 신원 범위 축소 값**을 내려보내고 있다. 비운영자 역할을 한 값(예: `member`)으로 합치면 현재 소비처 전부가 그대로 동작한다. 운영코드 변경이라 이 티켓 범위로 처리하지 않고 별건으로 올렸다.

## 남긴 파일

| 파일 | 역할 |
|---|---|
| `scripts/qa/apply_local_migrations.mjs` | 로컬 검증 DB 를 현재 revision 스키마까지 올림 (이름 화이트리스트로 프로덕션 오사용 차단) |
| `scripts/qa/seed_community_anonymity_fixture.mjs` | 실명 표식이 들어간 계정·글·댓글 fixture |
| `scripts/qa/dev_server.mjs` | Next 를 node 로 직접 띄우는 실측용 서버 |
| `scripts/qa/probe_community_anonymity_local.mjs` | 목록·상세·댓글 payload 키 + 실명 표식 실측 |
| `scripts/qa/probe_community_display_local.mjs` | 표시 이름 브라우저 노드 단위 실측 |

커밋해 두는 이유: 커밋하지 않은 준비 스크립트는 다음 세션에 **없는 것과 같다.** (A)(B) 는 프로덕션에 실사용 데이터가 쌓이기 전까지 이 경로로만 재확인된다.
