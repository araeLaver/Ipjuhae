# 계약 전 대화 요청

운영 경로 `/contract-talk`. 메인 ‘계약 전 대화 요청하기’에서 시작한다. 기존 입주해 계정으로 로그인한다. 임차인은 상대 임대인이 가입/로그인할 이메일과 가능한 시간 1–3개를 입력한다. 지정한 이메일의 임대인 계정만 공유 링크를 열고 응답할 수 있다. 상대 계정의 존재 여부는 생성 화면에서 공개하지 않는다. 이메일 원문은 이 기능 DB에 저장하지 않고 정규화된 SHA-256 비교값만 저장한다.

수리 연락 방법, 입주 일정, 추가 확인 사항 세 질문에 답하거나 시간을 제안한다. 링크는 사용자가 직접 전달한다. 자동 이메일/SMS/캘린더/영상통화/점수 계산은 없다. 링크 생성·복사는 전달 또는 열람으로 집계하지 않는다. 기존 Trust Card·DataScore·계약 전 확인 리포트 및 점수 정의는 변경하지 않는다.

당사자별 답변 합의·추가 확인, 대화 완료, 확인 완료를 구분한다. 확인 완료는 당사자의 표시이며 신원·서류·사실 진위·계약 성립·법적 안전을 검증하거나 보장하지 않는다. 이름·연락처·소득·신분증 등의 민감 자료를 본문에 적지 않도록 안내한다.

## 권한과 보존

기존 getCurrentUser()/JWT 폐기/탈퇴 검사를 사용한다. 소유 임차인과 지정된 이메일의 임대인만 접근하며 최초 응답 후 해당 사용자 ID를 고정한다. 링크만으로 계정 권한을 얻지 않는다. 무관 계정/비로그인은 접근 차단된다. 공유 식별자는 32바이트 난수이다. no-store/noindex/no-referrer를 적용한다.

요청자는 응답 전 일정을 수정하고 언제든 취소할 수 있다. 지정 이메일을 잘못 입력하면 취소 후 새 요청을 만든다. 취소 시 답변/제안시간/합의를 지운다. 완료 후에도 당사자가 ‘정정 위해 대화 다시 열기’를 선택하면 양측 완료·합의를 초기화하고 정정할 수 있다. 다시 확인 완료를 표시해야 한다.

초대는 7일 만료. 만료 후 30일이 지난 이 기능의 기록만 매일 기존 CRON_SECRET을 이용하는 전용 cron과 생성 시 정리한다. 요청자 계정 삭제는 FK cascade로 이 기능 기록을 삭제한다. 응답자 탈퇴 시 기존 인증에서 차단되며 보존 기간 후 기록을 정리한다. 운영 요청 생성은 계정당 하루 10개, API는 기존 IP당 분당 60개 제한에 더해 계정당 분당 120개(현재 단일 운영 머신 기준). 신규 영구 키나 접근 권한은 만들지 않는다.

## 저장 및 배포

기존 lib/db transaction/parameter SQL과 새 contract_talk_requests 테이블을 사용한다. 생성 중복은 owner/client_key unique와 owner별 advisory lock으로 방지한다. 수정은 row lock과 version 비교를 사용한다. migration-045-contract-talk.sql은 신규 테이블/인덱스만 추가한다. 기존 데이터/권한은 변경하지 않는다. 기존 Fly runtime DB migration workflow에서 plan을 확인한 후 apply한다. 기능 긴급 비활성은 CONTRACT_TALK_DISABLED=1(선택 사항). 운영 UI/API는 실제 인증·Postgres를 사용하며 합성 로그인 fixture 경로는 Next 앱에 존재하지 않는다.

## 격리 검증

Mac의 임시 PostgreSQL: loopback 55437, DB_SCHEMA=contract_talk_test. 실제 운영 환경 파일을 복사하지 않는다. 기존 migration 전량을 적용한 이 테스트 스키마에만 테스트 계정을 만든다. 기존 /api/auth/login을 사용하는 브라우저 시나리오는 `CONTRACT_TALK_REAL_E2E=1 ...playwright test --config=playwright.contract-talk.real.config.ts`로 실행한다. PostgreSQL 통합 테스트는 `CONTRACT_TALK_PG_TEST=1 ...vitest run __tests__/contract-talk`이며 local host와 테스트 스키마를 강제한다.

scripts/qa/contract-talk-local.ts와 playwright.contract-talk.local.config.ts는 별도 합성/메모리 테스트 fixture이다. NODE_ENV=production에서 실행할 수 없고 Next 경로에 연결되지 않는다. 실제 DB/인증 통합 검증과 구분한다. 합성 fixture의 임대인 이메일은 landlord@example.test, 무관 계정은 stranger@example.test이다.
