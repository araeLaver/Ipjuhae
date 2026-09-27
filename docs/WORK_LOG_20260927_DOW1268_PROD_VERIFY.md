# 2026-09-27 — DOW-1268 프로덕션 실측 / DOW-1275 마지막 구멍 수정

## 한 일

1. DOW-1262(커뮤니티 `author_role` 접기)의 프로덕션 실측 3항목 — 전부 PASS
2. 그 실측이 **새 코드와 옛 코드를 구분하지 못한다**는 것을 확인하고, 배포 산출물 직접 대조로 대체
3. 그 대조에서 옛 식이 남은 곳 1군데를 발견 → DOW-1275 로 분리하고 수정까지
4. 기존 브라우저 프로브의 거짓 안심 구멍 1건 발견 → 별도 프로브로 메움

## 1. 배포 확인

```
Fly Deploy  run 36298… / 36284633564  sha cf02e912  success  2026-09-27T01:11:37Z
  Checkout tested commit  success
  Deploy to Fly.io        success
```

`cf02e912` ⊇ `8f6e0674`(DOW-1262). CEO 판정대로 push 는 96초 뒤의 문서 커밋에 동승해 이미 일어나 있었다.

## 2. 프로덕션 실측 3항목

`scripts/qa/probe_community_author_role_prod.py` — 공개 읽기만, 계정 생성·쓰기 0건.

```
list: 18건 → author_role {'admin': 18}
detail: 18건 → author_role {'admin': 18}
comments: 행 0건
PASS 값 집합 ⊆ {admin, member} / guest·tenant·landlord 0건 / author_name·author_id 없음
```

화면은 `scripts/qa/probe_community_display_name_browser.mjs` (playwright, className 으로 노드 구분):
상세 메타 줄 이름 `입주해` + 배지 `운영자` 1회 → PASS.

## 3. 이 실측의 한계 — 스스로 구분력이 없다

옛 식 `COALESCE(u.user_type,'guest')` 로도 운영자 글은 `admin` 이다. 즉 위 PASS 는 **배포가 안 먹었어도 똑같이 나온다.** 구분되는 입력이 프로덕션에 있는지 셌다.

```
postsByAuthorUserType:    [{admin, 18}, {(null), 2}]
commentsByAuthorUserType: []
totals: {posts: 20, comments: 0}
```

비운영자 작성 글 2건은 둘 다 `deleted_at IS NOT NULL` — soft-delete 라 목록·상세 필터에서 영구 제외. 되살리지 않았다. **프로덕션 payload 로는 원리상 구분 불가.**

### 대체 판정 — 배포된 산출물 직접 대조

Fly 컨테이너 `/app/.next/server` 의 `.js` 505개에서 두 식을 셌다.

```
newExpr (CASE WHEN u.user_type):
  community/posts/route.js, posts/[id]/route.js, posts/[id]/comments/route.js   각 1
oldExpr (COALESCE(u.user_type,'guest')):
  app/page.js                                                                   1
```

세 라우트 전부 새 식, 옛 식 0 → 배포가 먹었다는 직접 증거.

## 4. 그 대조가 잡은 새 결함 — DOW-1275

`oldExpr` 적중의 원본은 `lib/home-content.ts:87`(첫 화면 조회) 하나였다.

**지금은 유출이 아니다.** 근거 3겹:

- `app/page.tsx` 는 서버 컴포넌트, `author_role` 은 운영자 필터 한 곳에서만 쓰임
- `grep -rln HomePost app/ components/` → 0건 (클라이언트 경계 없음)
- 프로덕션 `/` HTML: `author_role`·`tenant`·`landlord`·`guest`·`author_name`·`author_id` 전부 0회

세 번째는 판정력이 약하다 — 공개 글이 전부 운영자 글이라 일반 역할이 나올 입력이 없다. 무게는 첫 두 개에 있다.

### 수정 (`8e197190`)

- SQL 을 세 라우트와 같은 `CASE WHEN` 식으로
- `HomePost.author_role` 을 `string` → `'admin' | 'member'` 로 좁힘 — 값만 접으면 같은 결함이 다시 들어온다. 다음 소비처가 타입에서 막히게 하는 쪽이 진짜 잠금이다
- 테스트 `__tests__/lib/home-content-author-role.test.ts` 3건. **DB 대역이 SELECT 목록을 읽는다** — 고정 행을 주면 SQL 을 되돌려도 값 판정이 통과해 버린다

### 대조군

SQL 만 옛 식으로 되돌려 실행:

```
Tests  2 failed | 1 passed (3)
  FAIL 값 판정 (landlord 가 그대로 나옴)
  FAIL SQL 판정 (COALESCE 적중)
  PASS 운영자 연재 필터
```

운영자 케이스는 **양쪽에서 통과한다** — 운영자는 어느 식에서도 `admin` 이라 판정력이 없다. 그 케이스는 "접기가 과해서 연재가 사라지지 않는지" 를 보는 반대편 안전장치로만 의미가 있다.

### 게이트

```
tsc --noEmit         exit 0, 출력 0줄
vitest run           901 passed / 7 skipped, 85 파일
```

둘 다 `rtk proxy` 로 돌리고 exit code 를 별도로 확인했다(`npm run typecheck` 는 rtk 가 재작성해 거짓 초록을 낸 이력이 있다).

## 5. 프로브 도구의 거짓 안심 구멍 1건

`probe_community_display_name_browser.mjs` 는 목록에서 **첫 10개 링크만** 본다. 프로덕션 목록 상단은 번호+제목만 있는 행이라 작성자 메타를 가진 행을 한 번도 보지 않고 `'운영자' 출현=0` 을 찍는다.

`scripts/qa/probe_community_list_author_nodes.mjs` 로 목록 전체 링크를 훑어 확인:

```
링크 수 8 / 작성자 표기가 렌더된 행 0
→ 작성자 표기는 상세에만 렌더된다. 목록은 이 항목의 판정 대상이 아니다
```

"목록도 PASS" 라고 적으면 판정하지 않은 것을 판정했다고 말하는 셈이라 나눠 적었다.

## 6. 되돌린 것 1건

`scripts/qa/probe_community_anonymity_prod.py` 를 같은 이름으로 새로 쓰다가 기존 DOW-1249 프로브(중첩 키 경로까지 훑는 개인식별 키 검사)를 덮어썼다. `git checkout` 으로 복구하고 내 것은 `probe_community_author_role_prod.py` 로 분리했다. 두 프로브는 **키 유무**와 **값 집합**이라는 다른 결함을 잡으므로 둘 다 남겼다.

교훈: 새 프로브를 만들 때 파일명을 먼저 `git ls-files` 로 확인한다. Write 는 기존 추적 파일을 조용히 덮는다.

## 7. 미실측 — 댓글 경로

프로덕션 `community_comments` 는 **전체 0행**. 댓글 payload 의 `author_role` 은 프로덕션에서 한 번도 판정되지 않았다. 코드·로컬 실DB·배포 산출물 3겹으로만 확인된 상태다. 일반 사용자 글·댓글이 생긴 뒤 재확인(CEO 결정에 따라 별건 유지).

## 8. push 는 하지 않았다

```
8e197190  fix(home)  DOW-1275 첫 화면 author_role     ← 내 것, 운영 런타임
82014dc7  test(qa)   DOW-1268 프로브 3종               ← 내 것, QA 전용
0d77d7b8  ops        DOW-1272 누수 관측 도구 9종
e6fdeb8a  fix        댓글 커서·전체 공개 개수 표시        ← 남의 운영 런타임 (DOW-1237, in_progress)
f5425819  test(qa)   DOW-1254 signup 프로브
```

push 는 브랜치 단위다. 올리면 DOW-1237 의 운영 런타임 변경이 승인 없이 배포된다 — **이 티켓(DOW-1268)을 만든 것과 똑같은 사고다.** 커밋까지만 하고 멈췄다.
