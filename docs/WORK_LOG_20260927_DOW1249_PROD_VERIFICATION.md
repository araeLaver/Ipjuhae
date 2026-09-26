# DOW-1249 — 커뮤니티 익명화 프로덕션 실측 (2026-09-27)

## 한 줄

실명 노출은 **09-27 00:17:39 KST 에 이미 멈춰 있었다.** 이 세션은 push 를 집행한 것이 아니라 *이미 배포된 상태를 인수해 실측으로 확정한* 세션이다. 7항목 중 5건 통과, 2건은 프로덕션에 데이터가 없어 판정 불가.

## 인수 시점의 사실 — 지시와 순서가 달랐다

티켓은 "미push 3건 push → CI → Fly → 실측" 이었으나, 착수 시점에 `origin/main..HEAD` 는 **docs 1건뿐**이었다. `git reflog show origin/main` 으로 복원한 순서:

| 시각 (KST) | 일 |
|---|---|
| 09-27 00:14:50 | `origin/main` `5658ac9f` → `eb3033e3`. DOW-1248 문서 push 에 앞에 쌓인 스택 6건이 **같은 push 에 함께 실려 나감** |
| 09-27 00:14:54 | CI `36251264292` success |
| 09-27 00:17:39 | Fly Deploy `36251430465` success — 프로덕션이 익명화 코드로 전환 |
| 09-27 02:21 | CEO 보류·재판정 지시 도착 (배포 2시간 경과) |
| 09-27 04:43 | 담당 CTO → 입주해 이전 |
| 09-27 05:01 | 남은 docs 1건 + QA 프로브 push (`6b5b142b`) |

의도적 범위 확대는 아니지만 **결과적으로 재판정 전에 나갔다.** 같은 브랜치에 남의 커밋이 쌓여 있으면 내 docs push 한 번이 그 전부를 배포한다 — `git add -A` 를 피하는 것만으로는 이 경로가 막히지 않는다.

## 실측 결과

통과 (프로덕션 실요청, 응답 키만 기록):

- 목록 `GET /api/community/posts` — item keys `audience author_role body category comment_count created_at id title view_count`, `author_name`·`author_id` 없음
- 상세 `GET /api/community/posts/<id>` — 위 + `is_author`, 동일하게 없음
- 운영자 표기 — 이름 노드 `"입주해"` + 배지 노드 `"운영자"`(`bg-primary`) 분리, 메타 줄 `운영자` 1회

판정 불가 (코드가 아니라 데이터가 없다):

- **댓글 payload 항목 키** — 프로덕션 글 18건 전수 확인, `comment_count > 0` 인 글이 0건. 응답은 `{"comments": []}`. 빈 배열로 "키 없음"을 주장하면 거짓 통과
- **일반 사용자 `익명` 표기** — 18건이 전부 `author_role: "admin"`, 일반 사용자 글 0건

## 실측 도구가 거짓 통과·거짓 실패를 각각 한 번씩 냈다

**거짓 PASS.** 처음 만든 HTML fetch 프로브가 통과를 냈는데, `/community` 는 클라이언트 렌더라 SSR 응답이 "아직 질문이 없어요" 스켈레톤이었다. 프로브가 센 `운영자`·`익명` 1회는 게시글 행이 아니라 **정적 마케팅 문구**였다. 게시글 제목이 HTML 에 있는지 대조해서 잡았다. 그 파일은 폐기했다 — 거짓 초록을 내는 하네스는 남겨 두면 다음 사람이 믿는다.

**거짓 FAIL.** 브라우저로 바꾼 뒤 `innerText` 정규식이 `입주해 운영자` 를 찾아 FAIL 을 냈다. `innerText` 는 이름 span 과 배지 span 을 공백으로 이어 붙이므로, 문구 검색으로는 "이름에 운영자가 박힌 결함"과 "정상 이름+배지"를 구분할 수 없다. 노드별(`className` 으로 이름/배지 구분) 추출로 바꿔 판정했다.

교훈: **화면 판정은 문자열이 아니라 노드 단위로 한다.** 회귀 테스트(`community-post-view.test.tsx:212`)가 "meta 줄의 `운영자` 1회"로 고정한 것과 같은 기준을 라이브에서도 노드로 재현해야 한다.

## 남긴 것

프로브 3종 (`6b5b142b`):

- `scripts/qa/probe_community_anonymity_prod.py` — 목록·상세·댓글 키 실측, 중첩 키 경로까지 스캔
- `scripts/qa/probe_community_comments_prod.py` — `comment_count>0` 인 글을 페이지 넘겨 찾아 댓글 키 실측 (댓글 0건 글을 잡는 거짓 통과 방지)
- `scripts/qa/probe_community_display_name_browser.mjs` — 표시 이름 노드별 실측. `networkidle` 은 이 페이지에서 끝나지 않아 조건 대기로 바꿨다

## 별건 후보

응답에 **`author_role` 이 모든 글에 그대로 실린다.** DOW-1236 UX 판정은 *배지 표시*에서 일반 역할을 뺐지만 *필드*는 남았다. 일반 사용자 글이 올라오면 익명 게시판 payload 에 `tenant`/`landlord` 가 실린다. 화면에 안 보여도 payload 를 읽는 쪽에는 신원 범위를 좁혀 주는 값이다. DOW-1211 에서 별건화 여부를 물었다.

## 상태

- [DOW-1249](/DOW/issues/DOW-1249) — `in_review`, 집행 잔여 없음
- [DOW-1211](/DOW/issues/DOW-1211) — 사후 승인 / 판정불가 2건 처리 / `author_role` 별건화 세 가지 판정 요청
- [DOW-1236](/DOW/issues/DOW-1236) — 운영 검증 결과 기록
