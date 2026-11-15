# 저장 검색 URL 유지 독립 QA

- 대상: [DOW-1419](/DOW/issues/DOW-1419), 구현 `d3fb2bc6`와 기존 미커밋 변경이 있는 작업 트리.
- 판정: 요청한 저장 검색 적용·새로고침·URL 직접 진입 완료 기준 통과. 제품 코드 수정 없음.
- 환경: 로컬 Next.js dev `http://127.0.0.1:3106`, Playwright Chromium headless. QA가 시작한 서버는 검수 후 종료했다.
- 자동화: `node scripts/qa/check-saved-search-url-browser.mjs`.

## 재현과 결과

이전 URL `/properties?q=합정&region=서울&type=oneroom&sort=created_at&cursor=old#results`로 진입한다. 저장 검색 패널을 열고 아래 각 조건의 적용 버튼을 키보드 Enter로 실행한다. 적용된 URL에서 새로고침하고, 다른 검색 URL로 이동한 후 복사한 URL에 직접 진입한다.

| 조건 | 적용 | 새로고침 | URL 직접 진입 |
| --- | --- | --- | --- |
| 합정 · 서울 · 원룸 · 월세순 | 통과 | 통과 | 통과 |
| 한강 뷰 & 역세권 · 경기 · 아파트 · 보증금순 | 통과 | 통과 | 통과 |
| 빈 조건 · 최신순 | 통과 | 통과 | 통과 |
| 빈 조건 · 조회순 | 통과 | 통과 | 통과 |

- 각 단계에서 q·region·type·sort의 주소창 값, 입력창, 지역·유형·정렬 Select, 현재 조건, 검색 API query와 fixture 매물 결과가 일치했다.
- 적용 시 이전 cursor 제거와 hash 보존을 확인했다. 한글·공백·`&` 키워드도 URL 재진입 후 유지됐다.
- pageerror 0, console error 0, Next.js 오류 overlay 0. 화면 캡처 `/tmp/dow-1419-url-0.png`부터 `-3.png`까지 생성했고 복합 조건 캡처를 시각 검토했다.
- 관련 5개 파일의 Vitest 27개 통과: `properties-saved-search-url`, `properties-filter`, `properties-empty-failure`, `saved-searches` component/API 테스트.
- `npm run typecheck`, `git diff --check` 통과.

## 위험도와 범위

이번 변경의 검증 범위에서 추가 품질 결함은 발견하지 않았다. API fixtures로 UI·URL·요청·응답 표시를 검증했으며 실제 DB 검색 정확도·인증·알림 전달·운영 배포 smoke는 검증하지 않았다. 이 판정은 운영 배포 승인이 아니다. 기존 작업 트리 변경이 포함되어 있으므로 구현 커밋 단독의 테스트 결과로 해석하지 않는다.
