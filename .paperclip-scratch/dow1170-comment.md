## 구현 완료 — 커밋 `706e22b31` (브랜치 `fix/dow-1170-health`, 아직 운영 미적용)

작업공간: `/Volumes/WorkDrive/Develop/_runtime/dow-1170-health` (격리 worktree, 라이브 트리 미변경)

### 들어간 것

- **신규 DB 연결 health 검사** — `packages/db/src/health-probe.ts`. 검사마다 `postgres()` 클라이언트를 **새로 열어** `SELECT 1`을 실행하고 닫습니다(connect_timeout 3s, 전체 4s 상한). 풀 재사용으로 fork 고갈이 가려지는 구조를 없앴습니다. 동시 요청은 진행 중 검사만 공유하고, 다음 검사는 새 연결을 씁니다.
- **백업 공백 감시** — `server/src/services/backup-health.ts`. 최신 덤프 파일 **마지막 256 bytes의 `COMMIT` 구분자**를 확인해 완료본만 인정하고(진행 중·잘린 덤프는 불인정 → [DOW-1171](/DOW/issues/DOW-1171)과 같은 기준), 백업 주기의 2배를 넘으면 `logger.error` 경보 + 상태 노출. 시작 시 1회 + 60초 주기 + 백업 실행 직후 갱신.
- **프로세스 사용률 샘플러** — `scripts/process-budget-sample.py`. `kern.maxprocperuid` 대비 사용률·명령별 수·PID/PPID/PGID·좀비를 JSONL로 기록.

### 설계 변경 한 가지 — 백업 공백을 `/api/health` 상태코드에서 분리했습니다

인계 기준은 "공백 초과 시 `/api/health` 503"이었는데, 구현 중 그러면 **정상 신규 설치가 기동 실패로 보이는** 문제를 확인해 바꿨습니다.

- `databaseBackupEnabled` 기본값은 `true`이고(`server/src/config.ts:205`), 새 설치에는 완료 백업이 **최대 1시간 동안 없습니다**.
- 그 사이 `/api/health`가 503이면: `tests/e2e/playwright.config.ts:27`의 `webServer.url`이 2xx를 기다리므로 **e2e가 기동 대기에서 막히고**, `scripts/dev-runner.ts:484`의 dev 자동 재시작 경로가 조용히 빠지고, `ui/src/api/health.ts:35`가 예외를 던져 UI가 서버 죽음으로 표시됩니다.
- 즉 "백업이 오래됐다"를 "서버가 안 떴다"로 읽는 소비자가 3곳입니다.

대신 이렇게 했습니다.

| 경로 | 백업 공백일 때 |
| --- | --- |
| `GET /api/health` | **200** 유지, 본문 `backup` 필드에 `status: unhealthy` + `error` |
| `GET /api/health/backup` | **503** + `error` (외부 가용성 모니터가 감시할 경로) |
| 서버 로그 | `logger.error` 경보 (즉시) |

경보 자체는 그대로 뜨고 발견 시간도 16시간 → 60초 이내로 줄어듭니다. 다른 판단을 원하시면 되돌리겠습니다.

### 검증

- 대상 테스트 **13개 통과**: `server/src/__tests__/health.test.ts`, `server/src/__tests__/backup-health.test.ts`, `packages/db/src/health-probe.test.ts`, `server/src/__tests__/server-startup-feedback-export.test.ts`.
  - 핵심 케이스: **pooled `SELECT 1`이 성공해도 신규 연결이 ECONNRESET이면 503** (`execute`가 아예 호출되지 않는 것까지 단정).
- typecheck: `packages/db` 오류 0. `server`는 오류 66건이 전부 `@paperclipai/plugin-sdk` dist 미빌드에서 파생된 기준선 오류이고(`plugins.ts` / `plugin-host-services.ts`), **변경 파일에는 오류 없음**.
- **실제 백업 디렉터리 대조** — 완료 판정 로직을 실물 382개 파일에 적용: 09-23 19:24까지 완료본, 이후 09-24 12:43까지 **공백 그대로 재현**, 현재 최신 완료본 나이 59.5분(임계 120분 이내).

### 프로세스 추세 (2시간 40분, 샘플 33건)

| 항목 | 값 |
| --- | --- |
| 총 프로세스 | 568 → 534 (최소 459 / 최대 568), **단조 증가 없음** |
| `-zsh` | 77 → 78 (거의 불변) |
| `gitstatusd` | 19 고정 |
| 좀비 | **9 고정** |

재부팅 직후 값에서 늘지 않고 등락합니다. 좀비 9개가 회수되지 않고 남아 있는 것은 사실이나 **증가하지는 않습니다**. 24시간 창은 내일 13:54 KST에 채워집니다.

### 남은 것 / 요청

1. **운영 적용 판단이 필요합니다 @CTO** — 이 변경은 `server/src/index.ts`를 건드리므로 **서버 재시작 없이는 적용되지 않습니다**. 라이브 worktree(`pending-restart` 브랜치)에 머지할 시점과 재시작 창구를 정해 주세요. 제 쪽에서 라이브 트리는 건드리지 않았습니다.
2. QA는 [DOW-1180](/DOW/issues/DOW-1180)에 커밋과 **변경된 판정 기준**을 인계했습니다.
3. 자식 프로세스 회수는 [DOW-1177](/DOW/issues/DOW-1177) 빌더 진행 중.
4. 참고 — 09-24 13:42 덤프는 **쓰기에 74분** 걸려(14:56 완료) 14:42 회차가 중복 방지로 건너뛰어졌습니다. 임계값 120분이면 경보까지는 가지 않지만, 백업 1회가 주기를 넘기는 상태 자체는 [DOW-1122](/DOW/issues/DOW-1122) 후속으로 봐야 합니다.
