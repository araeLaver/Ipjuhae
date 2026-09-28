# 홈 질문 조회 상태 독립 QA — 2026-09-28

[DOW-1299](/DOW/issues/DOW-1299)의 완료 기준을 통과했습니다. 수정 커밋 `974af1e3`을 포함하는 `d6ad558977c280afc1140be0cf8fa8af3d2f487a`를 검증했습니다.

- Chromium, 화면 너비 1280px·390px에서 정상 0건·정상 데이터·DB 예외·3.5초 지연의 총 8개 조합이 통과했습니다.
- 정상 0건에서만 첫 질문 권유를 표시합니다. 정상 데이터에서 질문 링크와 댓글 2개를 표시합니다.
- DB 예외·시간 초과에서는 실패 문구와 게시판 이동을 표시하며 빈 질문 문구와 첫 질문 권유는 없습니다.
- 모든 조합에서 보증금 점검과 제도 링크가 보이며 `/check` 이동 후 화면이 표시됩니다. 두 실패 상태에서 `/community` 클릭 이동과 화면 표시도 확인했습니다.
- 시간 초과 상태의 홈 검증 소요는 데스크톱 3329ms, 모바일 3161ms였습니다. 브라우저 탐색·assertion·screenshot을 포함하므로 2500ms timer의 정밀 측정값은 아닙니다.
- 관련 Vitest 7개 통과, 실제 DB 통합 1개는 환경 조건으로 skip. `npm run typecheck`, `git diff --check` 통과.

## 재현

저장소 루트에서 `QA_HOME_PORT=3198 node scripts/qa/check-home-query-state-browser.mjs`를 실행합니다. `git archive HEAD` 사본과 별도 Next.js 서버를 만들고 해당 서버 프로세스의 `pg.Pool`만 fixture로 대체합니다. 운영 DB에는 연결하지 않습니다. Playwright Chromium 설치가 필요합니다.

스크립트는 네 상태를 순서대로 주입하고 실제 SSR·hydration 화면의 문구와 클릭 이동을 검증합니다. 종료 시 서버와 브라우저를 닫으며 출력 경로에 screenshots, `results.json`, `server.log`를 남깁니다.

이번 증거 경로: `/var/folders/gw/bfdh7cq54nn0tq9352ss079m0000gn/T/rentme-home-qa-MGwH3s/evidence`.

## 범위와 위험도

이 수정의 회귀 위험도는 낮음으로 판단합니다. 실제 DB 연결·데이터 정확성, production build 및 운영 배포 후 smoke는 이번 검증 범위에 포함하지 않았습니다. 테스트 초기의 `networkidle` 대기 및 `pg` fixture 로딩 실패는 검증 도구에서 해결했으며 최종 실행은 8개 모두 성공했습니다. 제품 코드는 변경하지 않았습니다.
