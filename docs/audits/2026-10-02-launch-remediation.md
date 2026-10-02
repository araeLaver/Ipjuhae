# 2026-10-02 출시 감사 수정 · 검토 기록

기준: 원격 `main` ace709327206b655933f2e2f3df51cc3a65fce02. 작업 브랜치 `fix/launch-audit-20261002`, 기존 작업/QA 에뮬레이터와 별도 체크아웃. 운영 DB/스토리지/계정에 접속하거나 삭제하지 않았다. 신규 비용·서비스·운영 키·권한을 만들지 않았다.

## 공개 자격증명 제거

작은 독립 커밋 `52cda42c`는 `mobile/store-listing.md` 심사 계정 블록만 placeholder로 대체한다. 관련 Markdown 문서의 동일 값 재노출은 로컬에서 값 출력 없이 확인했다. 이력에 있는 값은 남아 있으며 운영자가 별도 비밀번호 변경/계정 정지를 결정해야 한다. 시험 로그인, 계정 회전/삭제, 이력 재작성은 수행하지 않았다. 이 커밋만 우선 main 반영할지 부모/사용자가 확정할 수 있다. **기존 base와의 문서 diff에는 제거된 값이 나타날 수 있으므로 로그·리뷰 설명·첨부 패치로 복사하지 말 것.**

## 데이터 관계와 처리 목록

다음은 코드/마이그레이션 기준 목록이며 운영 데이터의 존재 여부는 조회하지 않았다.

| 데이터 | 소유·관계 | 이 브랜치의 처리와 영향 |
| --- | --- | --- |
| users | 계정, OAuth 식별자, 프로필 사진, 전화, 동의 시간, Stripe 식별자 | tombstone 유지; 이메일/이름/전화/OAuth/사진/동의 값을 제거하고 비밀번호 무효화. Stripe 연결이 있으면 자동 삭제 전체 중단 |
| profiles / tenant_profiles / landlord_profiles / profile_views | 본인 상세 인구통계·생활·예산·회사·identity CI/DI·열람 관계 | 전체 프로필 행 삭제; 연관 열람 삭제. 일부 칼럼만 비우던 누락 해소 |
| verifications / verification_documents | 소득·재직·신용, 원본 이름/URL/거절사유 | 행 삭제. owned storage 원본을 DB 삭제와 동시에 대기열에 등록 |
| landlord_references / reference_responses | 제3자 집주인 연락처·설문·토큰 | 요청 행 삭제, 응답 FK cascade. 추가 history/dispute에 사용자 FK/JSON 연결이 있으면 검토 대상으로 중단 |
| conversations / messages | 임대인·임차인 공유 대화 | 해당 계정이 참여한 대화 전체와 양쪽 메시지 삭제. 무관한 상대-제3자 대화 보존. 기존 소켓 끊기, 재접속 때 DB 참여자·탈퇴 여부 검사 |
| contract_talk_requests | owner, payload.respondentId, recipient_hash(미응답 수신자 포함) | 본인 소유/응답자/수신자인 요청 전체 삭제. 상대 목록과 초대 링크에서도 사라짐. owner만 보는 soft delete를 보완 |
| properties / property_images / listings | 등록 매물, 계약 리포트 FK | 매물은 숨김, 제목/설명/주소·상세주소/지역 제거; 이미지 행·사진 배열 제거, owned 객체 대기열 등록. 매물 가격/면적 등 비식별 속성과 tombstone FK는 남음. 리포트/신뢰 증거 연결이 있으면 먼저 전체 요청 중단 |
| notifications / notification_preferences / push_tokens | 사용자별 알림·설정·Expo 토큰 | 본인 행 삭제. 상대 알림에 들어 있는 과거 자유문구 등은 본인 FK만으로 식별되지 않을 수 있음; 아래 한계 참조 |
| tenant_favorites / reviews | 본인/상대 관계 | 양쪽 관계 삭제, 본인 작성/대상 리뷰 삭제 |
| community_posts / comments / reports / blocks | 작성 계정, 신고자, 차단 관계 | 본인 글/댓글/신고/차단 삭제; 본인 글의 댓글은 cascade로 상대 댓글도 삭제. 익명 작성은 별도 계정 연결 없음 |
| data_consents / consent_events / api_idempotency_requests | 동의·요청 snapshot | 본인 행 삭제. 연결된 미지원 신뢰/감사 기록이 있으면 전체 중단 |
| analytics_events | user_id·session_id 또는 properties에 user ID/email | 해당 연결을 NULL/빈 properties로 제거하고 이벤트 횟수만 남김. contracttalk 집계는 처음부터 user/session 미연결 |
| magic_link_tokens / phone_verifications | email·전화 직접 연결 | 기존 이메일/전화와 연결된 토큰·OTP 삭제 |
| waitlist / early_access / feature_requests | 비회원도 입력, email/phone/contact 직접 연결 | 동일 계정 email/전화/contact를 가진 신청·피드백 행 삭제. 계정과 연결할 수 없는 익명/자유문구 요청은 자동 추정하지 않음 |
| revoked_tokens | JWT 재사용 방지 | 만료 전 거부 목록은 유지하고 user_id만 NULL로 전환; 보안상 기존 거부를 해제하지 않음 |
| trust_evidence/fact/derived/score/disclosure, document_intakes, transaction contexts, relationships, reference submissions | 사용자/대상/부동산·공유/추출본/원본 객체/파생본 | 연결이 있으면 전체 트랜잭션 중단. 법적 보존기간을 임의로 정하지 않음 |
| 조직·API client·구독·관리자/감사·appeal·delivery·processing 등 미지원 FK/JSON | 다른 사람/조직과 공유될 수 있음 | 현재 스키마의 모든 users FK 및 미지원 JSON 사용자 ID/email을 확인, 발견 시 전체 중단. 새 FK 테이블도 자동으로 누락한 채 성공하지 않음 |
| 외부 저장 객체 | 설정된 S3/R2 origin/path 또는 mock-storage | commit 후 삭제. 실패/프로세스 중단 시 durable queue 재시도. Google OAuth의 외부 avatar는 앱 소유 객체가 아니므로 참조만 제거. 다른 미확인 origin은 전체 중단 |

### 정책/운영 결정이 필요한 선택사항 — 출시 차단

1. 공유 계약 리포트/신뢰자료: (A) 관련 원본·추출본·파생본·공유 snapshot을 삭제하고 상대 권한을 철회, (B) 분쟁/계약상 필요한 최소 필드만 별도 접근 제한 보관하고 나머지 삭제. B를 선택할 경우 근거, 대상 필드, 책임자, 기간, 접근권한/종료 삭제를 운영자·법률 검토로 확정해야 한다. 지금은 어느 쪽도 임의 확정하지 않고 409로 전부 중단한다.
2. 구독/Stripe/감사 자료: (A) 연결 해지·제3자 처리자 삭제 요청 후 자동 탈퇴, (B) 필요한 최소 거래/감사 기록 분리 보관 후 탈퇴. 결제 취소·Stripe 계정/고객 삭제·운영자 기록 삭제는 이 작업에서 실행하지 않았다. 무료 구독 행도 현재 미지원 관계로 보류하므로 운영자 결정 후 범위를 구분해야 한다.
3. 공유 대화·리뷰·커뮤니티 글의 상대 기록: 구현안은 대화 전체/내 글의 댓글 스레드까지 삭제한다. 상대 사본을 남길 필요가 있다면 해당 필드와 안내를 명시하고 삭제 설계를 다시 검토해야 한다. 단순 보존 문구 확대를 해결책으로 삼지 않았다.
4. `/privacy`의 즉시 파기 설명: 외부 객체는 DB commit 후 처리하며 실패 시 queue로 재시도한다. 개인정보처리방침은 이 PR에서 중대한 내용을 임의 개정하지 않았다. 실제 서비스 수준·미지원 자료 처리 기준과 함께 운영자가 문안을 검토해야 한다. 그 전에는 정책/행동 일치가 완성됐다고 볼 수 없다.

### 삭제의 한계와 남은 검증

DB 트랜잭션과 외부 객체 삭제는 하나의 원자적 트랜잭션이 아니다. DB rollback 전에는 객체를 건드리지 않고 commit 뒤의 재시도로 수렴하도록 설계했다. 한 번에 20개를 처리하며 기존 인증 cron cleanup 및 예약돼 있는 trust-maintenance에 연결했다. 실제 배포 환경의 스케줄러가 동작하는지와 backlog/실패 모니터링은 미확인이다.

운영 DB의 스키마 편차, 예전 저장 URL/공유 객체, 다른 사람의 자유문구에 들어간 개인정보, 외부 이메일·서버 로그·백업·Stripe·OAuth 제공자 데이터, 익명 피드백을 계정에 연결하는 방법은 확인되지 않았다. 현재 users/verification_documents/property_images/listings에 다른 사용자와 같은 URL이 있으면 전체 요청을 중단한다. 다른 테이블/외부 시스템/예전 URL alias로 공유되는 객체는 추가 소유관계 검토가 필요하다. 이 PR을 전 데이터 삭제 완료나 법 준수 보증으로 승인하면 안 된다.

## 신고·차단·동의

- 기존 `/api/community/reports`에 네이티브 댓글 신고를 연결했다. post/comment 동시 신고 입력은 거부한다. 작성자 신고는 해당 작성자의 위반 글/댓글을 신고 대상으로 전달하며 기존 중복 방지와 3건 자동 숨김을 재사용한다.
- `/api/community/blocks`는 기존 사용자 인증 및 middleware CSRF를 사용한다. client가 author ID를 보내지 않고 post/comment만 지정하면 서버가 읽을 수 있는 판인지, 본인인지, 계정 작성자인지 판정한다. 안정적인 author ID는 응답에 싣지 않는다.
- 차단은 **양방향 커뮤니티 노출**에 적용한다(웹 홈, 목록, 직접 상세 URL, 댓글 조회/작성 및 댓글 집계). 제3자와 본인의 다른 활동은 유지한다. 메시지/계약 전 대화 차단까지 확대하지 않았으며 UI도 커뮤니티 차단으로 안내한다. 계정 없는 작성자는 계정 차단 대신 신고를 안내한다. 차단 해제 관리 UI는 후속 항목이다.
- 네이티브 가입·글/댓글 작성 전 약관/개인정보 링크와 명시 동의를 추가했다. 이메일 가입 API는 필수 true 동의를 검증하고 동의 시간을 저장하며 기존 웹 가입 화면이 보내던 값을 이제 반영한다. 게시 전 동의는 네이티브 UI의 현재 작성 화면에 적용되며 서버에 별도의 동의 이력/약관 버전을 영구 저장하는 변경은 포함하지 않았다.
- 실제 사용자 신고/차단, 새 운영 키·권한 생성은 하지 않았다.

## 검증 및 독립 리뷰 절차

- `npm run typecheck`, `cd mobile && npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:run`.
- 격리 DB: 별도 `/tmp/ipjuhae-audit-pg`, 127.0.0.1:55439. 기존 DB/에뮬레이터를 사용하지 않음. 테스트는 매번 무작위 audit schema를 만들고 그 schema만 삭제한다.
- `ACCOUNT_ERASURE_SYNTHETIC=1 node_modules/.bin/vitest run __tests__/db/account-erasure-synthetic.test.ts`: 실제 저장소 SQL/migrations + 합성 사용자/가짜 storage. 운영 관리자 승인을 요구하는 migration-034/035만 제외한다. 운영 URL을 상속하지 않고 전용 포트로 고정한다.
- 검증: 성공 삭제와 무관한 대화 보존, 응답자/수신자 payload 삭제, DB late failure rollback/queue rollback, 객체 실패/성공 재시도·반복 삭제, 미지원 금융 관계 전체 중단, arbitrary storage URL 거부, 차단 본인/익명/역할/양방향/제3자 권한, author ID 비공개, 댓글 신고 중복·3건 자동 숨김, 탈퇴 후 소켓 membership 거부.
- 독립 리뷰는 `lib/account-erasure.ts` → migration-046/047 → `lib/account-storage-delete.ts` → API/소켓/cron → 합성 DB 테스트 순서로 권장한다. 특히 공유 기록 삭제 범위, 미지원 FK/JSON guard, 저장 객체 소유와 재시도, active socket 종료를 확인한다.
- 변경 비교는 비밀값이 제거된 `52cda42c` 이후 diff를 사용한다. 이 문서와 PR 설명에는 제거된 값을 포함하지 않는다.
- 실제 Android/iOS 빌드·EAS 권한·최종 SDK 동작·기기/에뮬레이터 QA·스토어 제출, 운영 migration/deploy/main merge는 미실행이다.

## 최종 검증 결과

- 전체 단위/화면 테스트: 955개 통과, 20개 조건부 생략(93 files passed / 4 skipped). 조건부 DB·기존 운영 연동 테스트는 기본 실행에서 생략한다. 합성 DB 8개는 별도로 명시 실행해 통과했다.
- 별도 합성 DB + 실제 댓글 집계 SQL: 8개 통과(2026-10-02). 네이티브 화면 테스트 21개 통과.
- 웹·모바일 typecheck / lint / 웹 build 통과. lint는 기존 경고, build는 외부 결제 키 미설정 경고가 있으며 실제 결제 서비스를 호출하지 않았다.
- Playwright: public 삭제 안내 200, 로그인 복귀 URL 유지, 미인증 destructive control 없음, 외부 Origin mutation 403, 미인증 same-origin mutation 401. 기존 에뮬레이터를 사용하지 않았다.
- 브라우저 첫 실행에서 기본 로컬 PG 연결이 SSL 협상 단계에서 실패한 페이지뷰 분석 로그가 있었다(데이터 SQL 실행 전). 명시적 55439 합성 DB로 서버를 다시 실행해 동일 웹 검증을 재실행했고 통과했다. 기본 연결을 테스트에서 사용하지 않도록 명시적 DB 설정을 기록한다.

## 독립 리뷰 보완 (2026-10-02, 후속 커밋)

- **URL 별칭 P1 재현:** 합성 URL의 percent-encoded 별칭이 기존 raw 공유 검사와 다른 문자열이면서 같은 삭제 key로 변환돼 타인 key가 큐에 들어가는 것을 확인했다. 재현 트랜잭션은 롤백했고 객체 삭제를 호출하지 않았다.
- **삭제 권한:** migration-048은 서버 업로드가 만든 object key/owner_user_id/저장소 scope 기록을 추가한다. 업로드는 인증 사용자 UUID의 서버 관리 namespace만 허용하며 S3 metadata에도 owner/scope를 기록한다. URL·참조 행·정규화만으로 소유권을 추정하지 않는다. 탈퇴 및 worker 모두 서버 소유권 기록과 현재 저장소 scope를 요구한다. 기존 URL로 자동 backfill하지 않는다. 증명 없는 기존 객체/큐, 다른 목적지의 객체는 자동 삭제하지 않고 검토 대상으로 중단/격리한다. 기존 객체의 신뢰할 수 있는 소유권 복원 또는 개별 검토는 운영 결정·추가 승인 대상이다.
- **기존 세션 P1:** verifyTokenAllowed에 실제 users.deleted_at IS NULL 확인을 추가했다. 폐기 목록에 없더라도 탈퇴한 사용자의 모든 기존 토큰은 거부한다. 정상 사용자는 유지하고 기존 cookie-only route에 Bearer-only 접근을 새로 허용하지 않았다. 합성 두 세션과 listings mutation으로 검증한다.
- **외부 삭제 공정성:** 실패 시 지수형 재시도 간격을 적용하고 due-time/attempt 기준으로 선택한다. 5회 실패 또는 소유권 증명 불가 항목은 review 상태로 격리한다. 기존 인증 cleanup 응답에 삭제/재시도/검토 건수를 포함해 영구실패를 확인할 수 있다. 외부 모니터·알림을 생성/발송하지 않았다. 20건 영구실패 뒤의 추가 5건이 처리되는 것을 합성 검증한다.
- **상대 알림 사본:** 삭제된 conversation ID와 일치하는 new_message 알림(발신자 이름·앞부분 preview 포함)을 동일 탈퇴 트랜잭션에서 삭제한다. 무관한 상대 알림은 남긴다. 일반 대화 전체 삭제라는 현재 구현 선택과 함께 검토할 항목이며 운영 데이터에 적용하지 않았다.
- **Android 신고 사유:** 5-button Alert를 사유 선택 Modal로 바꿔 네 가지 사유와 취소를 모두 표시한다. Android 설정의 컴포넌트 하네스로 실제 전송 대상/사유를 검증한다. 실제 기기/에뮬레이터 검증은 미실행이다.
- **범위 유지:** 차단은 계정 쌍의 양방향 커뮤니티 노출이다. 익명 작성자·DM·contract-talk·차단 해제 관리까지 완료했다고 보지 않는다. 게시 전 동의는 native UI 확인이며 서버의 약관 버전/영구 동의 이력을 강제하는 정책은 별도 결정 사항이다. 기존 법정 보존기간/공유 자료 결정은 미확정이다.

후속 커밋 최종 로컬 검증: 전체 957개 통과/26개 조건부 생략, 별도 합성 DB·실제 댓글 SQL 14개 통과, Android 설정을 포함한 네이티브 댓글/커뮤니티 화면 31개 통과. 웹·모바일 typecheck, lint(기존 경고), production build 통과. 새 migration-048은 합성 DB에만 적용했으며 운영 적용·기존 객체 backfill은 하지 않았다.
