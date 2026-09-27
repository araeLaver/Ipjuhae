# scripts/ops — 호스트 프로세스 누수 관측 도구 (DOW-1272)

전부 **읽기 전용**이다. 아무 프로세스도 죽이지 않는다.

[DOW-1251](/DOW/issues/DOW-1251) 의 교훈대로, 다음 회차가 맨손으로 재측정하지
않도록 저장소에 둔다. 커밋 안 한 도구는 다음 세션에 없는 것과 같다.

| 스크립트 | 답하는 질문 |
|---|---|
| `inspect-process-leak.py` | 지금 `down` 프로세스가 몇 개이고, 좀비·셸·부모가 어떻게 분포하나 |
| `process-age-histogram.py` | 어떤 프로세스 계열이 **여러 나이 구간에 퍼져** 있나 (= 계속 생기고 안 죽는 계열) |
| `inspect-leak-detail.py` | 좀비의 부모는 누구이고, 고아 셸은 언제 어떤 그룹에서 생겼나 |
| `paperclip-descendant-tree.py` | Paperclip 서버의 **살아 있는 자손**이 몇이고, 서버보다 오래 산 것이 몇인가. `--watch 60 --rounds 10` 으로 증가율 측정 |
| `find-orphaned-adapter-children.py` | `ppid=1` 로 재부모화된 **어댑터 고아**를 명령줄로 지목 |
| `trace-process-budget-history.py` | server.log 의 가드 메시지에서 예산 사용량 궤적 추출 |
| `anchor-server-log-days.py` | server.log 는 **UTC 시각만 찍고 날짜를 안 찍는다**. 자정 넘김으로 day index 를 세고 앵커로 실제 날짜를 고정 |
| `count-detached-child-leaks.py` | 재시작 횟수와 고아 사건을 날짜별로 집계 |
| `query-detached-runs.py` | 임베디드 DB 에서 `process_detached` / `Process lost` 흔적 조회 |

## 반드시 알아야 할 함정

**server.log 에는 날짜가 없고 시각은 UTC 다.** `[14:44:46]` 을 오늘 오후로 읽으면
5일 전 사건을 진행 중인 장애로 오독한다. [DOW-1272](/DOW/issues/DOW-1272) 최초
보고와 CEO 1차 판정이 둘 다 이 함정에 빠졌다. 날짜가 필요하면 반드시
`anchor-search-log-days.py` 를 거칠 것.

```
python3 scripts/ops/anchor-server-log-days.py <로그에_있는_run_id_앞8자> <그_run의_UTC_ISO>
```

## 확정된 근본 원인 (2026-09-27)

- `packages/adapter-utils/src/server-utils.ts` `runChildProcess` 는 자식을
  `detached: true` 로 띄운다 → 자식이 자기 프로세스 그룹 리더가 된다.
- `server/src/index.ts` 의 SIGINT/SIGTERM 핸들러는 `runningProcesses` 를 건드리지
  않았다 → 재시작마다 실행 중이던 자식과 하위 트리가 launchd 로 재부모화되어 영구 잔존.
- `server/src/services/heartbeat.ts` `reapOrphanedRuns` 는 살아남은 고아를
  탐지하고도(`child pid N is still alive`) **일부러 살려둔다**. 상한이 없다.

수정: Paperclip 저장소 `pending-restart` 브랜치 커밋 `0e46fcebd`
(종료 시 회수 경로 + 전/후 대조 테스트). 반영은 서버 재시작 시점.
