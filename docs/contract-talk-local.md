# 계약 전 대화 요청 — 로컬 테스트 버전

질문 세 가지와 가능한 시간을 임차인이 정리하고 링크를 직접 전달한다. 로그인한 임대인이 답변 또는 시간을 제안한다. 양측이 각 답변의 합의/추가 확인을 표시하고, 대화 완료와 확인 완료를 별도로 기록한다. 링크 생성·복사는 전달 또는 열람 완료로 집계하지 않는다.

## 실행 (실제 환경 파일 없는 별도 체크아웃)

설치된 기존 node_modules를 사용하며 새 외부/유료 서비스는 필요 없다. 실제 `.env.local`이나 운영 JWT/DB 값을 복사하지 않는다. 아래 JWT 값은 합성 계정용 로컬 임시 값이며 운영에서 사용하지 않는다.

터미널 1:

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" NODE_ENV=development NEXT_TELEMETRY_DISABLED=1 CONTRACT_TALK_TEST_ENABLED=1 JWT_SECRET=local-build-only-dummy-secret DATABASE_URL='postgresql://e2e:e2e@127.0.0.1:1/e2e?connect_timeout=1' NEXT_PUBLIC_APP_URL=http://127.0.0.1:3104 npm run dev -- --hostname 127.0.0.1 --port 3103
```

터미널 2 (같은 체크아웃):

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" NODE_ENV=development CONTRACT_TALK_TEST_ENABLED=1 JWT_SECRET=local-build-only-dummy-secret DATABASE_URL='postgresql://e2e:e2e@127.0.0.1:1/e2e?connect_timeout=1' node node_modules/tsx/dist/cli.mjs scripts/qa/contract-talk-local.ts
```

짧은 사용 흐름:

1. 임차인 브라우저 프로필에서 `http://127.0.0.1:3104/__local/login/tenant`를 연다. 가능한 시간을 고르고 요청을 만든 뒤 링크를 직접 복사한다.
2. 별도 시크릿/브라우저 프로필에서 `http://127.0.0.1:3104/__local/login/landlord`를 연 후 공유 링크를 붙여넣는다. 질문에 답하거나 시간을 제안한다.
3. 양측에서 ‘최신 내용 확인’을 눌러 답변을 보고 각자 합의/추가 확인을 표시한다. 각각 ‘내 대화 완료’를 표시한다. 세 답변에 양측 합의가 있고 추가 확인이 해소되면 각자 ‘내 확인 완료’를 표시할 수 있다.

로그인 URL은 이 별도 loopback 테스트 서버의 합성 계정 fixture이다. 서비스 로그인 API나 실제 계정을 만들지 않는다. 실제 계정·토큰 폐기·탈퇴 검사는 Next API의 기존 `getCurrentUser()`에 맡긴다. fixture는 기존 JWT 형식의 30분 합성 세션으로 인증을 흉내내며 운영에서 실행할 수 없다. 두 프로필은 같은 역할 쿠키를 공유하면 안 된다.

데이터는 로컬 서버 메모리에만 저장된다. 서버 재시작 시 사라지며, 초대 링크는 7일 후 만료된다. 생성은 임차인만, 답변은 로그인 임대인만 가능하다. 최초 응답자는 원자적으로 고정된다. 이후 본문은 요청자와 그 응답자만 볼 수 있다. 다른 임대인·임차인·관리자는 예외 권한이 없다. 요청자는 응답 전 일정만 수정하고 언제든 취소할 수 있다. 응답 수정은 양측 중 누구도 대화 완료를 표시하지 않은 동안만 허용하며 기존 답변 합의를 초기화한다. 확인 완료 기록은 추가 수정하지 않는다.

공유 식별자는 32바이트 무작위 값이며 URL에는 질문/답변/시간/이름/계정 ID를 넣지 않는다. URL만으로 로그인이나 계정 권한을 얻지 않는다. 영구 인증정보·외부 권한·API key는 만들지 않았다. 공유 링크는 사실상 만료되는 초대 정보이므로 의도한 상대에게만 직접 전달한다.

## 테스트

위 두 서버를 실행한 상태에서:

```sh
node node_modules/@playwright/test/cli.js test --config=playwright.contract-talk.local.config.ts
npm run test:run -- __tests__/contract-talk
npm run typecheck
npm run lint
```

브라우저 테스트는 localhost 합성 서버용이며 일반 E2E 실행에서는 건너뛴다. 별도 config가 로컬 E2E 플래그를 켠다. fixture의 `/__local/advance`는 만료 테스트를 위해 내부 시계만 8일 이동하며 운영 API에는 이 경로/기능이 없다.

## 기존 기능 재사용 및 경계

- 인증: 기존 `getCurrentUser()`와 users.user_type. 로그인/토큰 폐기/계정 상태 검사 코드는 변경하지 않는다.
- 저장: 기존 `lib/db.ts`의 파라미터 SQL·transaction 패턴. 수정은 `SELECT … FOR UPDATE`로 직렬화하고 version을 비교한다.
- 기존 messages 대화방은 상대 계정 ID가 있어야 하므로 링크 초대에 재사용하지 않는다. 기존 레퍼런스/거래/점수 계산도 변경하지 않는다.
- HTTP: 동일 Origin 검사, JSON 스키마/8KB 제한, no-store, 계정/참여자 검사. 응답/본문/식별자를 로그에 쓰지 않는다.
- 화면: noindex/nofollow/no-referrer. 민감정보 입력란, 외부 발송, 캘린더 초대, 영상통화, 자동 점수와 전환율은 추가하지 않는다.
- 기본 flag는 꺼져 있다. `NODE_ENV=production`에서는 flag가 있어도 페이지/API가 404다. 기존 메뉴/메인 페이지에는 연결하지 않았다.

## 운영 전 별도 결정/승인

`docs/proposals/contract-talk-schema.sql`은 검토용 신규 테이블 SQL이며 실행·자동 마이그레이션 등록하지 않았다. Postgres adapter는 준비했지만 실제 DB 통합 검증은 하지 않았다.

실사용 전에는 임대인 로그인 부담, 초대 대상 확인/링크 재발급, 최초 응답자 고정 정책, 완료 후 재논의 방식, 만료 후 보존·삭제 및 응답자 탈퇴 시 데이터 처리, 운영 요청 한도/남용 방지를 결정해야 한다. 3개 질문과 7일 만료는 이번 테스트의 가정이다. 답변/합의 표시는 당사자가 남긴 기록이며 실제 임대인 신원·서류·계약 성립을 검증하지 않는다.

운영 단계는 SQL 영향 검토 및 마이그레이션 승인 → 격리된 Postgres 통합/실제 기존 인증 시험 → 제품 결정·권한/남용 검토 → 운영 flag 정책 변경 검토 → 병합·배포 별도 승인 순서다. 이번 요청에서는 원격 push/PR/main 병합/운영 마이그레이션/배포를 하지 않는다. Trust Card·DataScore·계약 전 확인 리포트 장기 방향과 점수 정의/배점은 유지한다.
