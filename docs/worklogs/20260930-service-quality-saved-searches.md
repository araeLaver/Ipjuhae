# 2026-09-30 입주해 서비스 품질 개선 작업 기록

## 현재 체크포인트
- 작업 디렉터리 및 Git 루트: `/Volumes/WorkDrive/Develop/02_Ipjuhae`
- 브랜치: `main`
- HEAD: `adef965b` — 독립 핑 감시기 회귀 및 런타임 주기 검증 보강
- 로컬 `origin/main` 기준 5커밋 앞선 상태. 이번 기록 저장 시 원격 fetch는 실행하지 않았다.
- 이번 개선은 미커밋 상태. 커밋·푸시·운영 배포·운영 DB 마이그레이션·알림 활성화는 실행하지 않았다.
- 기존 사업개발 자료, 커뮤니티 QA 스크립트, demo-network-isolation 테스트 등 다른 작업의 변경이 함께 남아 있다. 전체 파일 일괄 스테이징이나 초기화 금지.

## 요청 및 완료 범위
사용 가능한 수준으로 품질을 개선하고 서비스 기능 후보를 찾은 뒤, 우선순위 1번인 검색 조건 저장 및 신규 매물 알림을 구현했다.

### 사용성 개선
- 실제 Radix Select에서 매물 필터를 열 때 발생할 수 있던 빈 값 옵션 오류 수정.
- 검색 입력·필터 버튼 접근성 이름과 열림 상태 추가.
- 매칭 API의 프로필 미작성 응답에 `total: 0`, `requiresProfile: true` 추가.
- 프로필 미작성·로그인 만료·조회 실패·정상 빈 결과를 구분하고 복구 경로 제공.
- 로그인 후 매칭 화면 복귀, 프로필 수정, 전체 매물 링크 추가.
- 브라우저 저장소 접근 거부가 매칭 화면을 중단하지 않도록 처리.
- 매물 카드에 월세와 관리비를 합친 월 고정비 표시(공과금 별도).

### 검색 조건 저장 및 알림
- 로그인 계정별 키워드·지역·매물 유형·정렬 저장, 불러오기, 삭제. 최대 10개.
- 동일 조건 동시 저장과 저장 개수 초과를 사용자 행 잠금으로 방지.
- 사용자 소유권 조건을 적용해 다른 계정의 검색 조회·수정·삭제 차단.
- 알림 수신은 사용자가 명시적으로 신청하며 켜기·끄기 제공.
- 기존 앱 알림 센터에 신규 매물 알림 표시. 이메일·SMS·외부 푸시는 발송하지 않음.
- 알림 켠 시점 이후 등록된 공개 매물만 대상으로 삼고 탈퇴 임대인·본인 매물 제외.
- 알림 재활성화는 해당 시점부터 시작하며 해제 기간의 매물을 몰아서 알리지 않음.
- 검색별 매물 중복 기록과 알림 INSERT를 같은 트랜잭션에서 커밋·롤백.
- 검색 행 잠금과 `SKIP LOCKED`로 여러 서버의 중복 처리를 방지.
- 내부 60초 스케줄러 및 인증된 cron API 연결.
- 기능 플래그 비활성화 시 알림 신청을 막고 조건 저장·삭제·기존 알림 해제는 제공.
- 알림 URL을 열면 저장 조건 복원.
- 회원 탈퇴 시 저장 조건과 중복 기록 삭제, 개인정보 내보내기에 저장 조건 포함.

## 변경 파일 목록 — 이번 작업만
기존 파일 수정:
- `.env.example`, `Dockerfile`, `server.js`, `scripts/build-ops-deadman.mjs`
- `app/api/account/delete/route.ts`, `app/api/account/export/route.ts`
- `app/api/matches/route.ts`, `app/matches/page.tsx`, `app/properties/page.tsx`
- `db/migrate.ts`

신규 파일:
- `app/api/saved-searches/route.ts`
- `app/api/cron/saved-searches/route.ts`
- `components/properties/saved-searches.tsx`
- `lib/saved-search.ts`, `lib/saved-search-alerts.ts`
- `db/migration-046-saved-searches.sql`
- `__tests__/api/saved-searches.test.ts`
- `__tests__/components/matches-recovery.test.tsx`
- `__tests__/components/properties-filter.test.tsx`
- `__tests__/components/saved-searches.test.tsx`
- `__tests__/db/saved-searches-real-db.test.ts`
- `scripts/qa/check-saved-searches-browser.mjs`
- `docs/service-quality-plan-20260930.md`
- `docs/saved-searches-20260930.md`
- 이 작업 기록

## 검증 근거 및 한계
이전 작업 실행 결과를 기록한 것으로, 기록 저장 시 전체 테스트를 재실행하지 않았다.

| 검증 | 결과 |
| --- | --- |
| 전체 Vitest | 941개 통과, 24개 건너뜀(94개 파일 통과, 3개 파일 건너뜀) |
| 실제 PostgreSQL 별도 실행 | 신규 테스트 6개 통과. 로컬 DB에 고유 임시 스키마 생성 후 삭제 |
| 신규 API 테스트 | 인증·입력 검증·플래그·cron 인증·실패 응답 5개 |
| 신규 검색 UI 테스트 | 실패 복구·로그인 복귀·적용/알림/삭제·비활성화 4개 |
| 프로덕션 빌드 | 통과 |
| 별도 타입 검사 | 통과 |
| 변경 파일 ESLint | 오류 0, 기존 매물 이미지 최적화 경고 1개 |
| Chromium 브라우저 | 조건 복원 → 저장 → 알림 해제 → 조건 적용 → 삭제 통과, 페이지 오류 0개 |
| Git diff 공백 검사 및 JS 문법 검사 | 통과 |

- 실제 DB 테스트 6개는 전체 Vitest에서는 환경변수 미설정으로 건너뛰며 별도 실행으로 확인했다.
- 브라우저는 빌드된 로컬 앱과 API fixture 응답을 사용했다. 운영 DB와 연결한 전체 사용자 여정 검증은 아니다.
- 로컬 브라우저 테스트 서버(3106)는 검증 후 종료했다.
- 운영 로그인 → 검색 저장 → 신규 매물 등록 → 실제 알림 수신 흐름은 배포 후 검증 필요.
- 빌드 환경의 Stripe 키 미설정 경고와 기존 Hook·이미지 최적화 경고는 남아 있다.

## 이어서 실행할 명령
```sh
cd /Volumes/WorkDrive/Develop/02_Ipjuhae
git status --short --branch
git diff --check
npm run test:run
npm run build
npm run typecheck
```

실제 DB 테스트(로컬 호스트만 허용, 계정명은 로컬 환경에 맞게 설정):
```sh
SAVED_SEARCH_TEST_DATABASE_URL=postgresql://<local-user>@127.0.0.1:5432/ipjuhae_db \
  npx vitest run __tests__/db/saved-searches-real-db.test.ts
```

브라우저 테스트는 별도 로컬 프로덕션 서버를 실행한 상태에서:
```sh
node scripts/qa/check-saved-searches-browser.mjs
```
기본 테스트 주소는 `http://127.0.0.1:3106`이며 `SAVED_SEARCH_BROWSER_URL`로 로컬 주소를 지정할 수 있다. API는 fixture로 대체되므로 운영 데이터 쓰기는 발생하지 않는다.

## 운영 적용에 남은 일
1. 기존 변경과 이번 변경을 구분해 코드 검토 및 필요한 커밋 정리.
2. 운영 마이그레이션·배포 범위 승인 후 migration 046 포함 DB 마이그레이션 적용.
3. 신규 코드 배포 후 `SAVED_SEARCH_ALERTS_ENABLED=true` 설정 및 서버 재시작.
4. 실제 계정에서 신규 매물 알림 수신, 중복 방지, 해제 검증.

`main` 푸시가 다른 5커밋 및 자동 배포까지 포함할 수 있으므로, 운영 영향 범위를 확인한 뒤 진행한다. 이번 요청은 작업 기록 저장이며 외부 배포 승인을 추가로 받은 것으로 해석하지 않았다.

## 다음 기능 우선순위
- P1: 세입자용 후보 매물 저장·비교(보증금·월 고정비·면적·입주일).
- P2: 문의 읽음·응답 대기 상태와 미응답 안내.
- P2: 매물 정보 갱신일·신고 경로.
- P2: 방문·계약 확인 체크리스트.

상세 기획: [서비스 품질 계획](../service-quality-plan-20260930.md)
구현·운영 안내: [검색 저장 및 알림](../saved-searches-20260930.md)

## 커밋·푸시 진행 업데이트
사용자의 후속 `커밋푸쉬` 요청으로 이번 작업 25개 파일을 선택해 커밋·푸시한다. 운영 마이그레이션이 미적용된 상태에서 자동 배포를 피하기 위해 `feature/service-quality-saved-searches-20260930` 브랜치에 저장한다. 이 브랜치는 앞서 기록한 로컬 기존 5커밋도 포함한다. 위 미커밋·main 상태는 기록 작성 당시의 체크포인트이며, 최신 상태는 이 브랜치와 `git log -1`을 기준으로 확인한다. 관련 없는 사업개발·QA 변경은 커밋에서 제외한다.
