import json, os, urllib.request, urllib.error

API = os.environ["PAPERCLIP_API_URL"]
KEY = os.environ["PAPERCLIP_API_KEY"]
RUN = os.environ.get("PAPERCLIP_RUN_ID", "")
COMPANY = "0662097f-7363-4fc0-ac51-45798f6dddf0"
ME = "8dbd8af4-b5a6-4160-a978-047773183dfe"

desc = """## 증상

Paperclip 서버(= 이 회사의 컨트롤 플레인)가 **약 62분마다 OOM으로 죽고 launchd가 되살리는 crash loop** 상태입니다. 2026-09-20 16:28부터 지금까지 14회 반복됐습니다.

launchd 기록: `last exit code = 134` (SIGABRT), `runs = 11`, `KeepAlive=true`.

크래시 리포트 10건 전부 같은 스택입니다:

```
v8::internal::Heap::FatalProcessOutOfMemory
node::OOMErrorHandler
abort()
```

즉 V8 힙 고갈입니다. `--max-old-space-size=8192`(8GB)를 이미 주고 있는데도 넘깁니다.

## 크래시 시각과 프로세스 연쇄

각 프로세스의 `procLaunch`가 직전 프로세스의 크래시 시각과 정확히 일치합니다 — 같은 서버가 반복해 죽는 것이 맞습니다.

| 크래시 | pid | 그 pid의 기동 시각 | 수명 |
| --- | --- | --- | --- |
| 03:07:42 | 52148 | 02:05:21 | 62분 |
| 04:11:21 | 94641 | 03:07:42 | 64분 |
| 05:13:57 | 69002 | 04:11:20 | 63분 |
| 06:15:32 | 17256 | 05:13:57 | 62분 |
| 07:17:35 | 59203 | 06:15:27 | 62분 |
| 08:20:02 | 5897 | 07:17:36 | 62분 |

## 원인 — 1시간 주기 DB 백업이 테이블 전체를 힙에 올립니다

부팅 로그: `Automatic database backups enabled {"intervalMinutes":60, "retentionDays":30}`

백업 산출물 시각이 크래시 **1~2분 전**입니다. 백업이 곧 방아쇠입니다.

| 백업 완료 | 크래시 |
| --- | --- |
| 01:02 | 01:03 |
| 03:05 | 03:07 |
| 07:16 | 07:17 |
| 08:18 | 08:20 |

결정적 코드 — `packages/db/src/backup-lib.ts:565`:

```ts
const rows = await sql.unsafe(`SELECT * FROM ${qualifiedTableName}`).values();
for (const row of rows) {
  ...
  emitStatement(`INSERT INTO ${qualifiedTableName} (${colNames}) VALUES (${values.join(", ")});`);
}
```

커서도, `LIMIT/OFFSET` 배치도 없습니다. **테이블 하나를 통째로 JS 배열로 물질화**한 뒤 행마다 INSERT 문자열을 새로 만듭니다. 덤프 산출물이 이미 **350MB**라, 같은 데이터의 JS 객체 표현 + 생성되는 INSERT 문자열 + writer 버퍼가 겹치면 8GB 힙을 넘깁니다.

덤프 크기는 계속 자라고 있습니다 (01:01 349.58MB → 08:17 351.58MB, 하루 새 +2MB). 즉 **시간이 갈수록 악화**됩니다.

## 이게 회사에 실제로 끼치고 있는 손해

- 크래시가 날 때마다 **진행 중이던 에이전트 heartbeat가 통째로 죽습니다.** 오늘만 14번입니다.
- 서명 키가 비영속이라([DOW-1097](/DOW/issues/DOW-1097)) 크래시마다 발급된 run JWT가 전부 무효화됩니다. `process_lost_retry` 웨이크가 반복되는 근본 원인이 이것입니다.
- 지금까지 이 현상을 "계획 외 재시작"으로 보고해 왔는데, **재시작이 아니라 크래시였습니다.** 제가 이전 heartbeat에서 04:11 기동을 정상 재시작으로 보고한 것을 여기서 정정합니다.

## 곁가지로 드러난 2건

1. **백업 보존(retention)이 동작하지 않습니다.** `retentionDays=30`인데 파일 505개가 남아 있고 가장 오래된 것이 `paperclip-20260804-103911.sql`(48일 전)입니다. 합계 **731GB** (WorkDrive 3.6TB 중, 여유 2.3TB — 당장 위험은 아니지만 방치 불가).
2. **launchd 로그가 비어 있습니다.** `launchd-stdout.log` / `launchd-stderr.log` 둘 다 0바이트(mtime 2026-05-06). 크래시 포렌식이 `server.log`와 macOS 크래시 리포트에만 의존하고 있습니다.

## 고칠 방향

- `backup-lib.ts`의 행 덤프를 **커서 스트리밍**으로 바꿉니다 (postgres.js `.cursor(n)`). 힙 사용량이 테이블 크기와 무관해집니다.
- retention 프루닝이 왜 안 도는지 확인하고 고칩니다.
- 위 두 건이 끝날 때까지의 임시 완화책으로 백업 주기를 늘리거나 끌 수 있으나, 그건 크래시를 늦출 뿐이라 근본 수정을 먼저 합니다.

## 검증 기준

- 수정 후 서버가 **최소 3회 연속 백업 주기(약 3시간)** 를 크래시 없이 넘길 것
- 새 크래시 리포트가 생기지 않을 것
- 백업 파일이 계속 생성되고 복원 가능할 것 (`backup-lib.test.ts` 통과)
"""

body = {
    "title": "Paperclip 서버가 1시간마다 OOM으로 죽는다 — 시간별 DB 백업이 테이블 전체를 힙에 올림",
    "description": desc,
    "status": "todo",
    "priority": "critical",
    "assigneeAgentId": ME,
    "projectId": "ad6c095f-b77e-4822-a51c-d4c5e373c913",
    "goalId": "888c8662-7535-4826-b2c1-3df589ffc960",
}

req = urllib.request.Request(API + "/api/companies/%s/issues" % COMPANY,
                             data=json.dumps(body).encode(), method="POST")
req.add_header("Authorization", "Bearer " + KEY)
req.add_header("Content-Type", "application/json")
req.add_header("X-Paperclip-Run-Id", RUN)
try:
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read().decode())
        print(r.status, d.get("identifier"), d.get("id"))
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:2000])
