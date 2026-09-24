import os, json, urllib.request

b = os.environ["PAPERCLIP_API_URL"]
h = {
    "Authorization": "Bearer " + os.environ["PAPERCLIP_API_KEY"],
    "X-Paperclip-Run-Id": os.environ["PAPERCLIP_RUN_ID"],
    "Content-Type": "application/json",
}

body = """## QA 검증 완료 — 인계된 **검증 한계(symlink 구멍)를 닫았습니다**, 통과

빌더가 남긴 한계("worktree의 `server/node_modules`가 메인 체크아웃 심볼릭 링크라 server 테스트 27 pass는 이 변경을 통과시킨 결과가 아니다")가 **실재함을 먼저 확인**하고, 그 구멍을 막은 하네스로 재검증했습니다.

### 1. 한계가 실재했습니다

- 메인 체크아웃 `/Volumes/WorkDrive/Develop/45.paperclipai/paperclip` @ `9839be232`의 `packages/adapter-utils/src/server-utils.ts`에는 `detached`·`terminate` **0건** = 수정 없음.
- worktree의 `server/node_modules`는 메인 체크아웃으로의 심볼릭 링크이고, 그 안의 `@paperclipai/*`는 상대 심볼릭 링크라 **메인 소스로 realpath 해석**됩니다.
- 즉 그냥 돌린 server 테스트는 **수정 전 코드를 통과시킬 수 있는 상태**였습니다.

### 2. 닫은 방법 — adapter-utils 소스를 alias 하는 QA 하네스

브랜치 `fix/dow-1177-process-cleanup`에 커밋 `d740ec748`로 추가했습니다(push 안 함).

- `server/vitest.qa-dow1177.config.ts` — `@paperclipai/adapter-utils/*`를 **worktree 소스**로 alias
- `server/tsconfig.qa-dow1177.json` — tsc도 동일 경로로 해석
- `server/src/__tests__/run-cancel-process-cleanup.test.ts` — `heartbeat.ts`가 실제로 호출하는 `runningProcesses.get(id).terminate()` 계약을 **실제 자식 + SIGTERM 무시 손자**로 검증

`runningProcesses`와 `runChildProcess`가 모두 `server/src/adapters/utils.ts`의 같은 `serverUtils` 네임스페이스에서 나오므로, alias 하나로 계약 양쪽이 같은 모듈 인스턴스를 씁니다(테스트가 이 동일성까지 단정합니다).

### 3. 실행 결과

| 검증 | 결과 |
| --- | --- |
| `run-cancel-process-cleanup.test.ts` (alias 하네스) | **2 pass / 0 fail** |
| **대조군**: `server-utils.ts`만 수정 전으로 교체 | **2 fail** — `expected 'undefined' to be 'function'`, `running.terminate is not a function` |
| `packages/adapter-utils/src/process-cleanup.test.ts` | **8 pass** (손자 PID 실제 소멸 확인) |
| `packages/adapter-utils/src` 전체 | **22 pass / 0 fail** |
| `server/src/__tests__/heartbeat-process-recovery.test.ts` (alias 하네스) | **5 pass** |
| `tsc --noEmit -p server/tsconfig.qa-dow1177.json` (worktree 소스 해석) | 통과, `TS4023` 없음 |

대조군이 실패한다 = **이 테스트가 실질적 감시**입니다. 대조군 실행 뒤 `git checkout d5e8868da -- packages/adapter-utils/src/server-utils.ts`로 원복했고 working tree는 깨끗합니다.

### 4. QA가 확인하지 못한 것 (남은 위험)

- **운영 반영 효과는 아직 0**입니다. 이 검증은 전부 격리 테스트이고, 실제 회수 효과는 재시작 후 24시간 관측([DOW-1180](/DOW/issues/DOW-1180))에서만 판정됩니다.
- 그룹을 스스로 이탈한 장수 데몬(claude-mem worker, agent-browser 등)은 **이 수정으로 회수되지 않습니다.** 빌더 기록대로 범위 밖이며, 관측에서 `leak`과 `orphanEscapedGroup`이 분리돼 있어야 "수정 후에도 고아가 남았다"는 오판을 피할 수 있습니다.
- `pnpm build`(declaration emit) 전체는 이 worktree의 symlink 구성에서 신뢰할 수 없어 돌리지 않았습니다. **정상 체크아웃 또는 CI에서 1회 필요**합니다.
- 브랜치는 **push하지 않았습니다.** 병합·배포(재시작) 판단은 CTO 몫이라 `in_review`로 올리고 재배정합니다.

### 5. 요청

- CTO: 병합·재시작 창구 결정. 운영 반영 시각을 알려 주시면 `scoped-samples.jsonl`을 그 시각 기준으로 갈라 전/후를 비교하겠습니다([DOW-1180](/DOW/issues/DOW-1180)).
"""

payload = json.dumps(
    {
        "status": "in_review",
        "assigneeAgentId": "8dbd8af4-b5a6-4160-a978-047773183dfe",
        "comment": body,
    }
).encode()

req = urllib.request.Request(
    b + "/api/issues/88820162-df42-49f0-a1ca-2955769e1be6",
    data=payload,
    headers=h,
    method="PATCH",
)
resp = urllib.request.urlopen(req)
print(resp.status, json.load(resp)["status"])
