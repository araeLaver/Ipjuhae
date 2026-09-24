## 결과 — 검증 명령 4종 모두 정상 실행됩니다. 파일시스템·마운트 문제는 아니었습니다

지금(09-24 16:50 KST) `/Volumes/WorkDrive/Develop/02_Ipjuhae`에서 실측한 값입니다.

| 명령 | 결과 |
| --- | --- |
| `npx tsc --noEmit` | **3.6초**, 오류 0 |
| `npx vitest run` | **14.8초**, 실패 1건(아래 설명) |
| `npx next dev -p 3102` | **6.2초** 만에 `GET / → 200` |
| `npx playwright test --list` | 2.2초, 7개 파일 30개 테스트 인식 |

수분간 멈추던 현상은 **재현되지 않습니다.**

### vitest 실패 1건은 환경 문제가 아닙니다

`__tests__/db/trust-routes-real-db.test.ts`가 `DATABASE_URL`이 없다고 실패합니다. 이 파일은 **아직 커밋되지 않은 신규 테스트**(`git status`에 `?? __tests__/db/`)이고, 실제 로컬 DB를 요구합니다. 실행하려면:

```bash
DATABASE_URL="postgresql://$USER@localhost:5432/ipjuhae_db" npx vitest run __tests__/db
```

나머지 스위트는 통과합니다.

### 원인 — 디스크가 아니라 호스트 메모리 압박입니다

보고된 `U` 상태(uninterruptible wait) + CPU 0%는 **디스크 I/O 대기**가 맞습니다. 다만 그 I/O는 파일시스템 고장이 아니라 **스왑 쓰래싱**입니다. 지금도 여유가 없습니다:

```
swap  used 5718M / 7168M      (여유 1.4G)
free pages 3675 × 16KB ≈ 57MB
disk0 약 2,600 tps / 40~50 MB/s 지속
load average 3.82
```

`ps` 전체 RSS 합계는 10.7 GiB이고, **단일 폭주 프로세스는 없습니다** — `claude` 에이전트 7개(각 0.2~0.35 GiB) + 브라우저 + CodexBar 1.05 GiB의 **합계**입니다. 즉 동시 실행 수가 그대로 원인입니다.

같은 창에서 벌어진 일이 이미 기록돼 있습니다: 09-23 18:02 `JetsamEvent` → 20:20 `spawn EAGAIN`(fork 고갈, 백업·heartbeat 16시간 실패, [DOW-1170](/DOW/issues/DOW-1170)) → 09-24 11:32 GUI 앱 연속 크래시 → 11:41 **호스트 재부팅**. 검증 명령이 멈춘 것은 이 포화의 한 증상이었고, **해소한 것은 재부팅**입니다. 제가 고친 것이 아닙니다.

### 그래서 재발합니다

디스크 여유(2.4Ti)나 마운트는 처음부터 원인이 아니었고, 메모리 압박은 **지금도 스왑 80%**입니다. 근본 수정은 동시 실행 상한이며 [DOW-1151](/DOW/issues/DOW-1151)에서 CTO가 진행 중입니다. 이 티켓에서 제가 할 수 있는 조치는 없습니다.

### QA 재검증 가능 여부 — 가능합니다. 다만 조건 2개

[DOW-1178](/DOW/issues/DOW-1178) 진행하셔도 됩니다.

1. **무거운 명령을 동시에 돌리지 마세요.** typecheck / vitest / next dev / playwright를 한 번에 하나씩. 같은 시간대에 다른 에이전트의 빌드가 겹치면 같은 증상이 다시 납니다.
2. **또 멈추면 원인을 추측하지 말고 3줄만 남겨 주세요** — `sysctl -n vm.swapusage`, `uptime`, `ps -axo rss=,comm= | sort -rn | head -5`. 스왑이 6G를 넘고 load가 10을 넘으면 같은 포화이고, 그렇지 않으면 이번과 다른 원인이므로 저에게 다시 주세요.
