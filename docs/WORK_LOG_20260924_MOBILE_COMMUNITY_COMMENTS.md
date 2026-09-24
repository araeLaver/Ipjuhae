# 앱 커뮤니티 댓글 조회 복구 (DOW-1172 / DOW-1176)

## 문제

앱 커뮤니티 글 상세(`CommunityPostScreen`)에 댓글 목록이 아예 표시되지 않았다. UI 누락이 아니라 `mobile/src/services/api.ts`에 댓글 조회 함수 자체가 없었다. 웹은 `/api/community/posts/[id]/comments`로 댓글을 읽고 있었으나 앱에는 대응 호출이 존재하지 않아, 앱 사용자는 글 본문만 보고 대화 맥락을 전혀 볼 수 없었다.

## 변경

- `mobile/src/services/api.ts`
  - `CommunityComment` 타입(`id` / `body` / `createdAt` / `authorName` / `authorRole`)과 서버 응답용 `CommentRow` 추가.
  - `toComment` 매퍼로 `created_at` → `createdAt` 등 snake_case → camelCase 정규화.
  - `fetchCommunityComments(postId)` 추가 — `GET /community/posts/{postId}/comments`. 기존 `apiClient`를 그대로 사용해 `x-mobile-client` 헤더와 CSRF 처리를 잃지 않게 했다(맨 `fetch`를 쓰면 요청이 403으로 조용히 버려진다).
- `mobile/src/screens/CommunityPostScreen.tsx`
  - 댓글 목록 로드·표시, 로딩·빈 상태·오류 상태 처리.
  - 운영자 답변은 `authorRole` 기준으로 구분 표시.
- `mobile/src/navigation/AppNavigator.tsx`
  - 글 상세 라우트 파라미터를 댓글 로드에 필요한 형태로 정리.

## 검증

- `npx tsc --noEmit` (mobile): 통과.
- `npx vitest run __tests__/mobile/community-comments.test.tsx __tests__/api/community-comments-read.test.ts`: 9개 통과, 실패 0.
- 신규 테스트 2건은 실제 RN Context 하네스로 화면을 render해 댓글이 목록에 나타나는지 확인한다(소스 grep 방식이 아니다).

## 남은 한계

- **실기기 스모크 미실시.** 이 호스트에 Xcode / `simctl`이 없어 iOS Simulator 검증을 할 수 없다. CEO 판정으로 실기기 스모크를 완료 기준에서 제외하고 자동화 증거로 병합을 승인했다.
- **댓글 작성 기능은 이번 범위 밖.** 읽기 복구까지만 포함한다. 작성은 별도 판단으로 남겼다.
- 루트 `npx tsc --noEmit`은 stale `.next/types/app/home/page.ts` 참조와 `e2e/onboarding.spec.ts` 타입 오류로 실패하지만, 이는 이번 변경 이전 기준선에서도 동일하게 실패하는 기존 상태이며 회귀가 아니다.
