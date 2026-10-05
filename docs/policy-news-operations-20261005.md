# 정책소식 상시 갱신

## 동작

- 웹 방문 없이 Node 서버 시작 시 수집한다. 매 15분 점검, 정상 수집은 매시간, 실패는 15분 후 재시도한다.
- KST 기준 최근 45일을 3일 구간으로 모두 조회한다. HTTP 200인 XML 오류, 잘못된 응답, pagination 누락도 실패로 처리한다.
- DB에 결과, 최근 시도/전체 성공 시각, 실패 구간 수를 보관한다. 구간 실패 시 기존 결과와 새 결과를 합치며 전체 성공 시각을 갱신하지 않는다.
- PostgreSQL session advisory lock으로 서버 타이머·백업 cron·수동 호출의 중복 실행을 막는다. 하루 최대 900 API 호출로 제한하고 100회 여유를 둔다. 정상적인 기본 조회량은 하루 360회다.
- 홈페이지는 저장된 소식과 최근 확인 시간을 표시한다. 갱신 성공이 24시간 이상 없으면 기존 소식을 유지하고 확인 중 안내를 표시한다.
- GET `/api/policy-news/status`: 24시간 내 전체 조회 성공이면 200, 미설정/DB 오류/지연이면 503. 기사 발표일이 오래됐어도 새 소식이 없는 전체 조회는 성공이다.
- 인증된 GET `/api/cron/policy-news`: 수집 후 점검. 부분 실패도 503. GitHub `Policy news freshness`가 매시간 17분에 백업 수집과 점검을 수행하고 실패를 작업 실패로 표시한다. GitHub 스케줄 지연에도 내부 서버 타이머는 계속 동작한다.

## 배포

- 기존 main `5811fb3e`를 기준으로 정책소식 변경만 포함한다. 다른 feature 브랜치 작업은 포함하지 않는다.
- Fly `release_command`가 실제 runtime DATABASE_URL/schema에 migration-047만 적용하고 `_migrations`가 있으면 기록한다. 재실행은 안전하다. 다른 마이그레이션은 실행하지 않는다.
- release는 API 키 존재, 최초 전체 수집, freshness 점검을 요구한다. 실패하면 새 버전의 배포를 중단한다.
- 배포 후 `/api/policy-news/status` 200, 홈 최근 확인 시간, 다음 scheduler 실행 로그, GitHub 수동 점검의 성공을 확인한다. 이후 24시간 지속 성공은 다음날 상태로 확인해야 한다.
- CRON_SECRET은 운영 runtime와 GitHub production environment에서 같아야 한다. 값은 출력하지 않는다.

## 검증

- 타입 검사·수정 파일 ESLint·production build·diff 검사 통과.
- 전체 테스트: 95 파일 통과/3 skip, 967 통과/13 skip. DB 환경 미지정 테스트는 별도 실제 DB 검증으로 보완한다.
- 새 수집/운영 회귀와 기존 필터: 25개 통과. HTTP 200 XML 오류, KST 날짜, 45일 전체 조회, pagination, partial failure, 데이터 유지, 지연 감지, lock, 하루 quota, 방문 없는 시작을 검사했다.
- `node scripts/check-policy-news-local.cjs`: localhost DB의 임시 schema에서 migration 두 번 실행, 별도 pool의 영속 조회, 전체 upstream 실패 시 기존 소식 보존, 25시간 지연 감지를 검증한다. 종료 시 schema를 삭제한다.
- 실제 원본 API 45일 조회: 15구간 성공/실패 0, 임대차 필터 통과 3건. 최신 2026-09-21. 웹에 보이는 3건과 일치한다. 원본이 제공하지 않는 기사나 필터 범위 밖 기사는 포함하지 않는다.
- Fly CLI 로컬 인증 토큰 없음. GitHub의 기존 main CI→Fly Deploy 경로는 접근 가능하며 최근 배포는 성공 상태다. 운영 반영 전에는 현재 웹을 새 scheduler가 실행 중이라고 판정하지 않는다.

## 되돌리기

- 앱 버전을 이전 배포로 되돌린다. 추가 테이블과 데이터는 삭제할 필요가 없다.
- 최초 잘못된 설정은 release 실패로 막힌다. 알림이 실패하면 GitHub workflow 로그와 공개 상태 API를 확인한다.
