# 공인중개사 역할 수정 QA 재검증

대상 이슈: [DOW-1197](/DOW/issues/DOW-1197). 기준 HEAD `a7f34afb`.
검증 환경은 로컬 API `3007`, `ipjuhae_db.ipjuhae`, Android `emulator-5554`다.
현재 공유 작업트리로 빌드했으므로 해당 커밋만의 독립 빌드로 판정하지 않는다.

## 자동 검증

- `npx vitest run __tests__/api/messages-conversations.test.ts __tests__/api/mvp-smoke.test.ts __tests__/mobile/list-empty-failure.test.tsx __tests__/mobile/community-rules-parity.test.ts __tests__/api/auth-signup.test.ts`: 5파일, 61건 통과.
- 웹 `tsc --noEmit --pretty false --incremental false`, mobile `tsc --noEmit --pretty false -p mobile/tsconfig.json`: 오류 없음.
- `scripts/qa/check-conversation-role-matrix.mjs`: tenant/landlord/broker/admin 사이 6개 조합에서 생성·역방향 재사용·양쪽 참가자 UUID·목록 및 상세 상대 역할 모두 통과.
- 최초 실측에서는 실제 DB의 `conversations.landlord_id`와 `tenant_id`가 요청한 두 UUID인지도 직접 대조했다.
- 계정은 로컬 signup API로 생성했고 admin fixture만 해당 신규 QA 계정의 DB 역할을 바꿔 준비했다. 운영 계정 생성·변경 없음.

## 기존 실패 경로

기존 tenant QA 계정으로 로그인하고 broker UUID `d6544385-f91b-4c9b-a7d9-7b8333ddfce8`가 포함된 대화 목록을 조회했다.
API `other_user_type=broker` 및 새 release APK의 `공인중개사` 배지를 확인했다.
이전 `landlord`/`임대인` 오표시가 재현되지 않았다. 증거 `qa1197-message-fixed.png`는 이슈에 첨부했다.

APK는 `scripts/qa/build-qa-apk.sh`로 재빌드했다. 번들의 로컬 endpoint와 대조군 문자열 검증 및 설치가 성공했다.
기존 서버의 `.next` 파일 누락으로 HTTP 500이 발생했으나 QA 서버 재시작 후 복구되었다.

## 범위와 한계

C1 앱 신규 가입→재로그인→broker 유지→커뮤니티 이동은 9월 26일 QA 코멘트의 직접 검증 증거를 유지한다. 이번에는 API 가입과 새 APK 재로그인·역할 화면을 검증했다.
웹·앱 역할 상수는 별도 모듈이고 parity 테스트로 ROLE_LABELS와 SIGNUP_ROLES 값 일치를 검증한다. 단일 객체 공유 구조는 아니다.
iOS는 기존 CTO 결정대로 제외했다. 운영 배포와 운영 DB broker 수는 이번에 재확인하지 않았다.
QA 제품 코드 수정은 없으며 실제 API 회귀 스크립트와 검증 문서만 추가했다.

## Android 최종 판정

- broker·admin: 전용 화면 준비 중 안내, 각각 공인중개사·운영자 프로필 배지 확인.
- tenant: 신뢰 점수 홈과 임차인 프로필 배지 확인.
- landlord: 매물·조회수·관심·메시지 통계 홈과 임대인 프로필 배지 확인.
- 네 계정 각각 메시지 목록에서 다른 3개 역할의 배지를 확인했다(총 12개 방향).
- landlord 최초 자동 검사는 로딩 도중 실행되어 실패했다. API 응답 완료 후 재검증은 통과했다.
- 역할별 홈 스크린샷 4개와 기존 C3 수정 화면을 이슈에 첨부했다.

판정: 이번 역할 수정에 대한 로컬 Android/API QA 통과. C1의 기존 앱 가입 검증 증거와
이번 C2·C3·프로필 회귀 결과를 합쳐 완료 판정한다. 운영 배포 후 검증을 대신하지 않는다.
