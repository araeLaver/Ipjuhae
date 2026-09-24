# WORK LOG — DOW-1162 관심 매물 버튼 (2026-09-24)

담당: Fryndo (engineer) · 상위: DOW-1161(알림·확인·입력 UI 패턴 확정)
결과: `components/listings/FavoriteButton.tsx` **삭제** · 커밋 `d5656be2` · push 완료 · CI 녹색 · Fly Deploy 성공
상태: `in_review` → CTO (기능 신설 여부 판단 대기)

## 요청 내용

`components/listings/FavoriteButton.tsx`의 "관심 매물" 버튼이 `onClick`에서
`alert('관심 매물에 추가되었습니다.')` 한 줄만 실행하고 아무것도 저장하지 않았다.
티켓은 (1) 기존 관심목록 기능을 재사용해 실제 저장/해제를 붙이고 (2) 담긴 상태를 반영하고
(3) 비로그인 동작을 정하고 (4) 알림을 sonner `toast`로 바꾸라고 지시했다.
단, 저장 동작을 붙이지 못하면 `toast`로 바꾸지 말고 **버튼을 내리는 쪽**이 낫다는 경계 조건이 있었다.

## 조사 결과 — 재사용할 저장 경로가 없다

티켓이 지목한 "이미 있는 관심 매물 기능"은 이름만 비슷한 **다른 도메인**이었다.

| 항목 | 실제 내용 |
| --- | --- |
| `components/landlord/favorite-button.tsx` | 집주인이 **세입자 프로필**을 즐겨찾기. prop이 `tenantId` |
| `app/api/favorites/route.ts` | `tenant_favorites` 테이블. `user_type !== 'landlord'` → 403 (`:93`), 대상이 `user_type === 'tenant'`인지 검증 (`:110-126`) |
| `app/api/favorites/check/route.ts` | 동일 테이블 조회. `landlord_id` + `tenant_id` 쌍 |
| 매물 관심목록 테이블 | **없음** — `migrations/`·`db/migrations/`에 `favorit` 문자열 0건 |
| 매물 관심목록 API | **없음** — `app/api` 아래 관련 라우트는 위 세입자용 하나뿐 |

매물 id를 넣을 파라미터가 존재하지 않으므로 재사용이 불가능하다.
붙이려면 신규 마이그레이션 + 신규 엔드포인트가 필요하고, 그것은 티켓이 명시적으로 금지한 범위다.

## 추가 발견 — 이 버튼은 렌더되지 않고 있었다

`components/listings/FavoriteButton.tsx`는 **저장소 어디에서도 import되지 않는다.**
listings 상세가 `/properties/[id]`로 통합되면서 `app/listings/[id]/page.tsx`가
`redirect()` 한 줄로 축소됐고, 그 과정에서 남은 고아 파일이다.
현재 `/properties/[id]`에는 관심 매물 버튼 자체가 없다.

`.claude/worktrees/nostalgic-shockley`(오래된 detached 워크트리)에는 아직
`app/listings/[id]/page.tsx`가 이 컴포넌트를 렌더하는 옛 코드가 남아 있어 grep이 혼동을 줄 수 있다 —
`main`에서는 참조 0건이다.

## 조치

패턴 A(`toast.success`) 적용을 **하지 않았다.** 저장하지도 않는데 "저장됐다"고 말하는 toast가 될 뿐이기 때문이다.
"거짓말하는 버튼보다 없는 버튼" 원칙에 따라 파일을 삭제했다. 사용자 화면 변화는 0건(렌더되지 않던 컴포넌트).

## 검증

- `npx tsc --noEmit` 클린 — 삭제 후 참조 깨짐이 없다는 것이 미사용의 확증
- `node scripts/check-test-suite-health.mjs` — 테스트 648개 / 65파일 전부 통과, 죽은 스위트 0 (하한 606)
- CI `35950352384` 녹색: Type Check / Lint / Unit Tests / Build 4개 잡 전부 통과
- Fly Deploy `35950414842` 성공 → 프로덕션 반영 완료

## push 판단 근거

변경이 `components/` 한 파일 삭제로 `app/`·`lib/`·`db/`·`middleware.ts`를 건드리지 않고,
미push 스택이 이 커밋 1건뿐이었다. DOW-1133 상시 규칙의 무승인 push 조건에 해당한다.
(push 시점에 같은 워크트리에 다른 에이전트의 `components/community/community-post-view.tsx` 미커밋 변경이
있었으나, `git rm`으로 스테이징한 삭제만 커밋해 섞이지 않았음을 `git show --stat`으로 확인했다.)

## 남은 결정 (CTO)

"관심 매물" 기능이 제품에 없다는 사실은 그대로 남는다.

- **(A) 지금은 안 만든다** → DOW-1162 done으로 종결
- **(B) 만든다** → 독립 제품 티켓 필요. 최소 범위는 마이그레이션 1건(`property_favorites`) +
  `/api/properties/[id]/favorite` 계열 라우트 + `/properties/[id]` 버튼 + 목록 화면.
  DOW-1161(알림 패턴) 하위가 아니라 별도 티켓이 맞다.
