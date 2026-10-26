# 테스터 모집 헤더 역할별 검수 결과

- 판정: 지정 수정 커밋 `861dead0`의 역할별 모집 링크 수용 기준 충족. 운영 배포 검증은 별도다.
- 환경: 격리 작업 트리 `DOW-2530-tester-header`, 로컬 Next.js dev, Chromium, 1280×900 및 375×900.
- 인증: `/api/auth/me`와 notifications 응답을 Playwright route로 대체했다. 실제 로그인·DB·운영 권한 검증은 포함하지 않는다. 테스트 DB는 기본 격리 주소 `127.0.0.1:1`이므로 커뮤니티 조회 오류가 로그와 화면에 나타나며 헤더 검증과 분리했다.

| 역할 | 데스크톱 링크·이동 | 모바일 링크·이동·닫힘 | 계정 dropdown 이동 |
| --- | --- | --- | --- |
| 비로그인 | 통과 | 통과 | 해당 없음 |
| tenant | 통과 | 통과 | 통과 |
| landlord | 통과 | 통과 | 통과 |
| broker | 통과 | 통과 | 통과 |
| admin | 통과 | 통과 | 통과 |

각 메뉴에서 `앱 테스터 참여`가 한 번 표시되고 `/tester?from=header` 클릭 후 실제 모집 안내 heading이 표시됨을 확인했다. 기존 역할 대표 메뉴의 label/href를 함께 검증했다. 동일 브라우저에서 역할 변경 후 재진입한 경우와 React rerender로 동일 Header 인스턴스의 역할을 변경한 경우 모두 링크 유지·중복 없음이 통과했다.

## 재현 및 자동화

```sh
PLAYWRIGHT_PORT=3197 npx playwright test e2e/tester-header-roles.spec.ts --workers=1 --reporter=line
npx vitest run __tests__/layout/tester-header-roles.test.tsx
```

- Playwright: 11 passed (31.3s).
- Vitest: 1 passed.
- 스크린샷: 이 작업 트리 `test-results/tester-header-roles-*/모집-메뉴.png`에 역할·화면별 10장. 테스트 재실행 시 덮어쓸 수 있다.
- 제품 코드는 수정하지 않았다. 테스트와 이 보고서만 추가했다.

## 위험도 및 후속 사항

- 원래 세 역할의 헤더 참여 경로 누락은 수정본에서 재현되지 않는다. 홈 배너 경로가 있어 원 결함의 영향은 참여 접근성 저하 수준이었다.
- 낮음: 1280px landlord 헤더에서 브랜드와 여러 메뉴가 줄바꿈된다. 링크 클릭은 통과했으며 이 변경에 의한 신규 발생 여부는 판정하지 않았다. CTO는 향후 nav 밀도와 가독성을 검토할 수 있다.
- 운영 배포, 실제 계정 인증, 외부 Google 참여 제출, 전체 테스트 스위트는 이번 변경의 검증 범위에 포함하지 않는다. 배포 후 같은 5개 역할 스모크 테스트를 권장한다.
