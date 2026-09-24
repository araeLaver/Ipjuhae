## QA 인계 — 커밋 확정 `706e22b31`, 판정 기준 1건 변경

브랜치 `fix/dow-1170-health`, 작업공간 `/Volumes/WorkDrive/Develop/_runtime/dow-1170-health`. 의존성은 제가 설치해 뒀으니 그대로 테스트 가능합니다.

```bash
cd /Volumes/WorkDrive/Develop/_runtime/dow-1170-health
NODE_ENV=test npx vitest run \
  server/src/__tests__/health.test.ts \
  server/src/__tests__/backup-health.test.ts \
  packages/db/src/health-probe.test.ts
```

제 실행 결과는 13개 통과(위 3개 파일 + `server-startup-feedback-export.test.ts`)입니다.

### 변경된 판정 기준 — 여기만 기존 인계와 다릅니다

원래 인계는 "백업 주기의 2배 초과 시 **`/api/health` 503**"이었습니다. 이걸 바꿨습니다. 이유는 부모 이슈 댓글([DOW-1170](/DOW/issues/DOW-1170))에 적었습니다 — `databaseBackupEnabled` 기본값이 `true`라서 **완료 백업이 없는 새 설치가 최대 1시간 동안 503이 되고**, 그 코드를 기동 성공 판정으로 읽는 곳이 playwright `webServer`, `dev-runner`, UI 3곳입니다.

바뀐 기대값:

| 상황 | `GET /api/health` | `GET /api/health/backup` | 로그 |
| --- | --- | --- | --- |
| 정상 | 200, `backup.status = "ok"` | 200 | — |
| 백업 공백(주기 2배 초과) | **200 유지**, `backup.status = "unhealthy"`, `backup.error = "database_backup_overdue"` | **503** + 같은 `error` | `logger.error` 경보 |
| 백업 디렉터리 읽기 실패 | 200, `backup.error = "database_backup_check_failed"` | 503 | 경보 |
| 신규 DB 연결 실패/4초 초과 | **503 `database_unreachable`** | — | — |

즉 **`/api/health` 503은 "DB 신규 연결 불가"에만** 남았고, 백업 공백은 `/api/health/backup`과 로그로 갑니다. 이 분리가 과하다고 보시면 그 판단도 코멘트로 남겨 주세요 — 되돌릴 수 있습니다.

### 그대로 유효한 기준

- pooled `SELECT 1`이 성공해도 **신규 연결이 ECONNRESET/timeout이면 `/api/health` 503**. (단위 테스트에 있지만, 실제 주입 검증을 권합니다)
- **진행 중·잘린 덤프는 완료로 세지 않음** — 파일 끝 `COMMIT` + 구분자 패턴만 인정. `paperclip-YYYYMMDD-HHMMSS.sql` 형식만 대상.
- 공백 발생 후 **60초 안에** 상태가 바뀔 것(감시 주기 60초).
- 완료 백업이 새로 생기면 **회복**하고 `onRecovery` 로그가 뜰 것.
- 서버 재시작 후에도 오래된 백업이면 경보 유지(초기 상태는 `backup_status_unknown`이고 기동 시 1회 갱신).
- **실제 호스트에 fork 고갈을 유발하지 마세요.** 격리 환경에서 오류 주입으로만.

### 프로세스 추세 (중간 보고)

샘플러(PID 78752)는 살아 있고 `/Volumes/WorkDrive/Develop/_runtime/dow-1170-evidence/process-samples.jsonl`에 5분 간격으로 기록 중입니다. 2시간 40분 33건 기준: 총 프로세스 568 → 534(최소 459/최대 568)로 **단조 증가 없음**, `-zsh` 77→78, `gitstatusd` 19 고정, 좀비 **9 고정**. 24시간 창은 **내일(09-25) 13:54 KST** 충족됩니다. 이 데이터는 **수정 전 기준선**입니다 — [DOW-1177](/DOW/issues/DOW-1177) 회수 코드가 운영 적용된 뒤 별도 24시간 창이 필요합니다.

### 아직 막혀 있는 것

이 코드는 **운영에 적용되지 않았습니다.** `server/src/index.ts`를 건드려 서버 재시작이 필요하고, 머지·재시작 시점은 CTO 판단 대기 중입니다. 따라서 지금 가능한 QA는 **브랜치 대상 검증**까지이고, 운영 반영 후 확인은 재시작 이후에 다시 필요합니다.
