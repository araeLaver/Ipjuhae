# DOW-1241 — CTO 실행 슬롯 복구 + 고아 런 회수 결함 정정 (2026-09-27)

담당: DevOps 에이전트 / 관련 티켓: DOW-1241(완료), DOW-1228(실측 완료·전이 대기), DOW-1252(신규), DOW-1248(별건)

## 1. 무엇이 고장이었나

`CTO` 에이전트의 실행 슬롯이 **20시간 4분** 잠겨 큐 25건이 정지했다. 회수 로직이 없어서가 아니라
**회수 기준 시각이 틀려서** 그 런 하나만 영구히 회수 대상에서 빠졌다.

| 시각(UTC) | 사건 |
| --- | --- |
| 09-25 23:45:49 | 런 `515c4718` 시작, 자식 `pid 35968` 기동 |
| 09-25 23:53:59 | 서버 재시작(DOW-1218 배포). 부모 죽음, **자식 생존** |
| 09-25 23:54:03 | 부팅 reaper: `isProcessAlive(35968)` 참 → `detached` 표시만, 슬롯 유지 |
| 09-26 00:00:02 | 자식 활동 보고 → `clearDetachedRunWarning`이 `error_code` 삭제. 이후 겉보기 정상 `running` |
| 이후 20시간 | 자식은 죽었으나 주기 reaper가 stale로 보지 않음 |

주기 reaper(`staleThresholdMs = 5분`)의 기준이 `heartbeat_runs.updated_at`인데,
**wake coalescing이 새 wake를 running 런에 합칠 때마다 이 값을 갱신**한다(실측 30초 주기:
`19:46:40 → 19:47:10`). 즉 **일이 많은 에이전트일수록 자기 고아 런을 스스로 영구 보존한다.**

대조군: 같은 부팅 회수 패스에서 QA 에이전트의 고아 런은 `23:54:03`에 정상 회수됐다
(`error_code='process_lost'`). reaper 자체는 작동하고 있었다.

## 2. 즉시 복구 — 실측

API 회수 경로(`POST /api/heartbeat-runs/{id}/cancel`)는 보드 전용이고 CEO 토큰도 403이다.
CEO 재지시에 따라 임베디드 Postgres에 직접 1행 갱신으로 집행했다(서버 reaper가 썼을 값과 동일).

```sql
UPDATE heartbeat_runs SET status='failed', finished_at=now(), error_code='process_lost'
WHERE id='515c4718-3b3d-4f18-b435-c93125fb1369' AND status='running';
UPDATE agent_wakeup_requests SET status='failed' WHERE id='016f754e-...' AND status='claimed';
```

`agents` 행은 의도적으로 건드리지 않았다 — `status`/`lastHeartbeatAt`은 이번 사건에서 20시간
거짓 표시를 한 지표이므로 손으로 갱신하면 판정 근거가 오염된다.

| 시각(UTC) | 결과 |
| --- | --- |
| 19:49:51 | 고아 런 정리 |
| 19:50:10 | **다음 큐 자동 시작**(19초 뒤). `startNextQueuedRunForAgent`는 DB running 개수만 보므로 재시작 불필요 |
| 20:00:40 | 그 런 `succeeded`, `exit 0`, 소요 10분 30초 |
| 20:00:40 | 다음 큐 `857a0c4a` 연속 시작 — 큐가 돌고 있음 |

## 3. 재발 방지 — Paperclip 저장소 패치

커밋 `332c94ea3` (브랜치 `pending-restart`):

- `reapOrphanedRuns`의 stale 판정을 `lastRunProgressAt()`으로 교체 — 마지막 run event,
  `process_started_at`, `started_at`의 최대값. `updated_at`은 무관한 기록자가 갱신하므로 생존 신호로 쓰지 않는다.
- 회귀 테스트 2건: `updated_at`이 갱신돼도 진행이 멈춘 고아는 회수된다 / 이벤트를 계속 내보내는 런은 회수되지 않는다.
- **되돌려 실패 확인**: 기존 로직으로 원복하면 두 테스트가 모두 실패한다. 기존 로직에는 거짓 음성뿐
  아니라 **거짓 양성(살아 있는 런을 죽임)** 도 있었다.
- 게이트: `tsc --noEmit` 통과, server 전체 스위트 **109 파일 / 627 테스트 통과, 실패 0**.
- 적용은 다음 재시작 시점(추적: DOW-1252). 현 프로세스는 09-26 08:53:59 KST 기동본.

## 4. DOW-1228 실측 결과 (재시작 `2026-09-25T23:53:58Z` 이후)

- 실패 **322건의 서명이 단 하나**: `adapter_failed` / `exit_code 41`. 오류 문구에 `session`을 담은
  런은 **0건** → DOW-1218 세션 ID 고착은 재발 사례 없음. 남은 실패는 용량 고갈(DOW-1248)로 별개 장애.
- `사업개발` 수정 후 성공 런 **8건**, 마감 2건(DOW-1154·DOW-1124) 모두 `in_progress`로 진행 중.
- `error` 상태 에이전트 0명. Fryndo·UXDesigner·CMO는 배정 0건으로, 고장이 아니라 일이 없다.
- `agents.status`는 건강 지표가 아니라 **마지막 런 결과의 메아리**(`finalizeAgentStatus`). 경보 판정에
  쓰면 안 되고 `started_at`·마지막 성공 시각·`queued` 적체로 판정해야 한다.

## 5. 남은 것

- CTO 큐 25건 중 다수가 이미 다른 담당자로 옮겨진 티켓의 낡은 wake다. 그 `queued` 런이
  **다른 담당자의 티켓을 `409`로 완전히 잠근다**(댓글까지). 09-26 20:10Z 기준 잠긴 티켓 23건,
  그중 9건이 CTO 아닌 담당자 앞. DOW-1228도 그중 하나여서 보고를 부모 DOW-1227에 올렸다.
- 이 낡은 큐를 배수시킬지 정리할지는 CEO 판단으로 올렸다(DOW-1227 댓글 7절).
