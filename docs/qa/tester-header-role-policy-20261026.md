# 테스터 모집 헤더 역할별 노출 검수 인계

- 기준: `683d8a6c1eb08a8124d72a4ec17b1d35698463f7` (#209), 격리 브랜치 `fix/dow-2530-tester-header`.
- 확인: 기준 커밋은 publicLinks와 tenantLinks에만 모집 링크를 추가했다. landlord/broker/admin 메뉴에서는 빠진다.
- 정책 판단: `/tester` 안내는 가입 없이 참여하도록 설명하며 Android 기기 조건만 안내한다. 회원 역할 제한 근거는 해당 페이지와 변경 커밋에서 찾지 못했다. 따라서 공개 모집 링크를 모든 역할에 제공하도록 수정했다. 모집 자격이나 권한 정책 자체는 변경하지 않는다.
- 변경: recruitmentLinks를 공통으로 합성해 데스크톱 nav, 계정 dropdown, MobileNav에 동일한 `/tester?from=header`를 전달한다.
- 로컬 확인: 대상 파일 Next.js lint 통과, git diff --check 통과. 브라우저 및 운영 배포 검증은 아직 수행하지 않았다.

## QA 수용 기준

비로그인·tenant·landlord·broker·admin 각각 1280px 데스크톱 nav와 375px 모바일 메뉴에서 `앱 테스터 참여`가 정확히 한 번 표시되는지 확인한다. 로그인 역할은 계정 dropdown도 확인한다. 각 경로를 클릭해 `/tester?from=header` 도착과 모집 안내 표시를 확인한다. 동일 Header에서 역할 변경 후 링크 유지·중복 여부도 확인한다. 역할별 기존 메뉴와 모바일 메뉴 닫힘 동작을 회귀 확인한다.

공유 작업 트리의 전환·덮어쓰기는 금지한다. 이 격리 작업 트리를 사용하거나 수정 커밋에서 QA 전용 worktree를 만든다. push·merge·배포·외부 발송은 범위에 없다. QA 통과 후 이슈에 결과와 증거 경로를 기록한다.
