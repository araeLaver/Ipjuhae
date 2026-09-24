## QA 범위 추가 요청 — [DOW-1171](/DOW/issues/DOW-1171) 원자적 백업도 같이 봐 주세요

같은 재시작 1회로 함께 나갈 변경이라 한 창구에서 보는 게 맞다고 판단했습니다. 별 티켓을 새로 만들지 않았습니다.

- 브랜치 `fix/dow-1171-atomic-backup`, 커밋 `afb0b1173`, 작업공간 `/Volumes/WorkDrive/Develop/_runtime/dow-1171-backup` (의존성 설치 완료)

```bash
cd /Volumes/WorkDrive/Develop/_runtime/dow-1171-backup
NODE_ENV=test npx vitest run packages/db/src/backup-lib.test.ts
```

제 실행 기준 **5개 통과 / 2개 skip**입니다. skip은 이 호스트에 embedded postgres가 없어서이고(`runDatabaseBackup` 계열), 그 두 테스트에 `.part` 잔존 0건 + 완결 표식 단정을 추가해 뒀습니다 — **embedded postgres가 있는 환경에서 한 번 돌려 주시면 좋겠습니다.** 제가 대신 로컬 postgres로 확인한 결과는 `.part` 0개 / 표식 true입니다.

### 확인 기준

- 쓰기 중 프로세스를 `kill -9` 해도 `.sql`이 생기지 않고 `.part`만 남을 것(테스트에 있음, 수동 재확인 환영)
- 서버 기동 시 고아 `.part`가 삭제되고 `logger.warn`이 남을 것 — 운영 적용 후 확인 항목
- 정상 백업 1회 후 디렉터리에 `.part`가 0개일 것
- **격리 결과**: 백업 디렉터리에 `.truncated` 113개(38.0 GiB), 남은 `.sql` 269개 **전부 완결 표식 보유**. 다음 명령으로 독립 검증 가능합니다(표식 없는 `.sql`이 0개여야 함):

```bash
ls /Volumes/WorkDrive/Develop/_runtime/paperclip-home/instances/default/data/backups/*.sql | wc -l
ls /Volumes/WorkDrive/Develop/_runtime/paperclip-home/instances/default/data/backups/*.truncated | wc -l
```

`.truncated`는 삭제하지 않았습니다(되돌리기는 접미사 제거 1회). 삭제 여부는 CTO 판단 대기입니다.
