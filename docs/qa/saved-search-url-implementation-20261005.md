# 저장 검색 적용 URL 유지 구현 검증

- 원인: 저장 검색 적용은 React 상태만 변경하여 주소창에 이전 검색 조건이 남았다.
- 수정: `app/properties/page.tsx`에서 적용 시 `searchUrl`로 URL을 생성하여 `history.replaceState`로 갱신한다. Next.js history metadata와 hash를 보존하고 이전 cursor와 검색 조건을 제거한다.
- 회귀: `__tests__/components/properties-saved-search-url.test.tsx`는 실제 매물 페이지와 저장 검색 패널을 사용한다. 정렬만 다른 조건, 한글·공백·특수문자 키워드와 다른 지역·유형, 빈 조건의 최신순·조회순을 검증한다.
- URL 적용 직후 query를 확인하고 URL을 유지한 remount 및 다른 URL을 거친 재진입에서 입력값·API query·fixture 매물 결과가 일치하는지 검증한다.
- 실행: `npx vitest run __tests__/components/properties-saved-search-url.test.tsx __tests__/components/properties-filter.test.tsx __tests__/components/properties-empty-failure.test.tsx __tests__/components/saved-searches.test.tsx __tests__/api/saved-searches.test.ts` — 5개 파일, 27개 테스트 통과.
- 범위: 기존 미커밋 테스트 변경이 포함된 작업 트리에서 실행한 결과다. 실제 브라우저 새로고침·URL 직접 진입은 독립 QA 검수가 필요하다.

## QA 요청

이전 조건 URL에서 저장 검색을 적용하고 주소창·검색 UI·API 요청·매물 결과를 비교한다. 정렬만 다른 조건, 다른 키워드·지역·유형, 한글 공백 및 특수문자 키워드, 빈 조건을 각각 적용 후 새로고침하고 복사한 URL로 직접 진입한다. 오류 overlay와 console/pageerror도 확인한다. API fixtures 사용 시 실제 DB 검증과 구분하여 기록한다.
