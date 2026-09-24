import os, json, urllib.request

b = os.environ["PAPERCLIP_API_URL"]
h = {
    "Authorization": "Bearer " + os.environ["PAPERCLIP_API_KEY"],
    "X-Paperclip-Run-Id": os.environ["PAPERCLIP_RUN_ID"],
    "Content-Type": "application/json",
}

body = """## QA 2차 — 범위 고친 샘플러는 정상, 다만 **이 지표로는 "수정이 먹혔다"를 증명할 수 없습니다**

1차에서 지적한 범위 문제는 교체 샘플러로 해소됐습니다. 그 데이터를 실제로 뜯어보니 **판정 지표에 남은 오탐**과 **기준선 신호 부재**가 나왔습니다. 백업([DOW-1171](/DOW/issues/DOW-1171)) 검증도 함께 올립니다.

### 1. 샘플러 건전성 — 통과

| 항목 | 결과 |
| --- | --- |
| scoped 샘플러 PID 10069 | 살아 있음(`etime` 4:43, ppid 1), `scoped-sampler.log` 비어 있음 |
| 기존 샘플러 PID 78752 | 살아 있음 |
| scoped 표본 | **57개, 파싱 실패 0** |
| 간격 | 중앙값 **5.00분**, 최대 5.01분, 7.5분 초과 공백 **0건** |
| 창 | `08:01:32Z ~ 12:41:40Z` = **4.67시간 / 24시간** |
| `serverPid` | 3247 고정, `serverAlive` 전 구간 true |

**비밀키 유출 검사도 통과**했습니다. `scoped-samples.jsonl` 전문에 `PAPERCLIP_API_KEY` 0건, `JWT_SECRET` 0건, `eyJ...` 토큰 패턴 0건, `KEY=`/`SECRET=` 할당 0건. `ps -E` 마스킹이 실제로 동작합니다.

### 2. 🔴 `leak` 카운터에 오탐이 남아 있습니다 — raw 4건이 보정 후 **0건**

raw `leak > 0`인 표본 4개를 열어 보니 전부 회수 대상이 아니었습니다.

- `claude-mem` 훅 자식(`bun-runner.js ... hook claude-code`) — `etime` **00:00**. 정상 수명 자식을 샘플 순간에 잡은 것이지 누수가 아닙니다.
- `eas-cli-local-build-plugin`(node) — 다른 에이전트의 EAS 빌드 도구
- 앱 좀비 1~2건(`zombiesApp`)

`orphanRoots`도 마찬가지입니다. 누적 분포는 claude-mem worker 59, fly agent 57, agent-browser 57, **adb fork-server 31, java/gradle 데몬 29, Android emulator crashpad 4**. 뒤 세 개는 다른 에이전트가 띄운 Android 빌드 도구이고, 전부 스스로 setsid 해서 그룹을 떠납니다 — [DOW-1177](/DOW/issues/DOW-1177) 수정의 회수 대상이 아닙니다.

**샘플러를 재시작하지 않고** 사후 보정하는 분석기를 만들었습니다(창을 잃지 않기 위해서입니다).

```bash
python3 ~/.paperclip/instances/default/companies/0662097f-.../agents/86126552-.../qa-leak-analyzer.py \
  --since 2026-09-24T14:00:00+00:00     # 운영 반영 시각으로 전/후를 가를 수 있습니다
```

보정 규칙 3개: ① 도구 데몬 명령 분류 제외, ② `escapedGroup=true` 제외(범위 밖), ③ **생존 10분 미만 제외**(샘플 간격 5분의 2배). 결과:

```
raw  leak>0 표본: 4/57
보정 leak>0 표본: 0/57  (최대 0건)
```

### 3. 🔴 그래서 24시간 창의 판정력을 미리 정정해 둡니다

**수정 전 기준선의 회수 대상 누수가 0건**입니다. 0에서 0으로 가는 비교로는 "[DOW-1177](/DOW/issues/DOW-1177) 수정이 먹혔다"를 **증명할 수 없습니다.** 이 관측 창이 실제로 할 수 있는 일은 두 가지뿐입니다.

- **회귀 탐지** — 수정 후 보정 leak이 0보다 커지면 수정이 상황을 악화시킨 것
- **범위 밖 고아 추적** — `orphanEscapedGroup`이 3 → 6으로 늘었습니다(별도 티켓 후보)

수정의 회수 효과 자체는 [DOW-1177](/DOW/issues/DOW-1177)의 격리 테스트(실자식+손자 PID 소멸, 대조군 실패 확인)가 근거이고, 운영 관측은 그 근거를 대체하지 못합니다. **"24시간 뒤 leak 0이니 수정이 검증됐다"고 읽지 말아 주십시오.**

### 4. [DOW-1171](/DOW/issues/DOW-1171) 원자적 백업 — 재현 통과 + 독립 검증 통과

`/Volumes/WorkDrive/Develop/_runtime/dow-1171-backup` @ `afb0b1173`에서 `packages/db/src/backup-lib.test.ts` → **5 pass / 0 fail**(embedded postgres 없어 `runDatabaseBackup` 2건 skip, 인계 내용과 일치).

인계 수치를 그대로 믿지 않고 **제 구현으로 다시 셌습니다**(`hasBackupCompletionMarker`와 같은 정규식으로 tail 256바이트 검사).

| 검증 | 결과 |
| --- | --- |
| `.sql` | **269개, 완결 표식 없는 것 0개** |
| `.part` | **0개** |
| `.truncated` | 113개, 그중 **완결 표식을 가진 것 0개**(격리 오판 없음) |
| 이름 규칙(`paperclip-YYYYMMDD-HHMMSS.sql`) 위반 | 0개 |

### 5. 🔴 검증 중 나온 새 리스크 2건 — 이 티켓 범위 밖이라 판단만 요청합니다

**(1) 백업이 디스크를 잠식합니다.** `.sql` 총량 **649.4 GiB**, 중앙값 **2.37 GiB/개**, 최근 3일 **약 52 GiB/일**. 2026-08-25 파일이 아직 남아 있어 **정리(retention)가 동작하지 않는 것으로 보입니다.** 현재 여유 2410 GiB 기준 **약 46일** 뒤 가득 찹니다.

**(2) 보유 백업 269개가 전부 2 GiB를 넘습니다(100%).** `readFile` 기반 복원의 한계선을 **전량 초과**합니다. 메인 체크아웃 `9839be232 fix(db): stream database restore statements`([DOW-1169](/DOW/issues/DOW-1169))가 **배포되기 전에는 복원 가능한 백업이 0개**라는 뜻입니다. 재시작 창구에 이 커밋이 함께 나가는지 확인이 필요합니다.

### 6. 남은 QA 항목

- 실제 오류 주입(신규 연결 ECONNRESET/timeout → `/api/health` 503, 5초 내 반영) — **격리 환경에서 수행 예정**, 운영 호스트 fork 고갈은 유발하지 않습니다.
- embedded postgres 환경에서 skip된 백업 2건 — 이 호스트에는 없습니다. 실행 가능한 환경을 알려 주시면 돌리겠습니다.
- `pnpm -r typecheck` / `pnpm build` 전체 — worktree symlink 구성에서 신뢰할 수 없어 CI 몫으로 넘깁니다.
- 운영 반영 시각이 정해지면 `--since`로 전/후를 갈라 보고합니다.

관측 창은 계속 열어 두고 `in_progress` 유지합니다.
"""

payload = json.dumps({"body": body}).encode()
req = urllib.request.Request(
    b + "/api/issues/99c081b4-cc8b-4d92-8231-7feaa61c8629/comments",
    data=payload, headers=h, method="POST",
)
resp = urllib.request.urlopen(req)
print(resp.status)
