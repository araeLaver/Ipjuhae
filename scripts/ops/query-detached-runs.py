#!/usr/bin/env python3
"""DOW-1272 — Paperclip 임베디드 DB 에서 "고아 자식 프로세스" 흔적을 읽는다 (읽기 전용).

reapOrphanedRuns 는 이전 서버 세대의 자식 pid 가 아직 살아 있으면 run 을
`process_detached` 로 표시하고 **프로세스를 그대로 둔다**. 그 흔적은 server.log 가
아니라 heartbeat_runs / heartbeat_run_events 에만 남으므로 DB 를 직접 읽어야 한다.
"""
from __future__ import annotations

import os
import subprocess
import sys

# 임베디드 postgres 번들에는 psql 이 없다(initdb/pg_ctl/postgres 뿐).
# Homebrew 쪽 클라이언트로 붙는다 — 서버는 18 beta, 클라이언트는 16이지만 조회는 된다.
PSQL = "/opt/homebrew/opt/postgresql@16/bin/psql"
PORT = "54329"
# server/src/index.ts 의 EmbeddedPostgres 설정과 동일한 로컬 전용 자격 증명.
USER = os.environ.get("PAPERCLIP_PG_USER", "paperclip")
PASSWORD = os.environ.get("PAPERCLIP_PG_PASSWORD", "paperclip")

QUERIES = [
    (
        "error_code 분포 (최근 14일)",
        "select coalesce(error_code,'(null)') ec, count(*) "
        "from heartbeat_runs where created_at > now() - interval '14 days' "
        "group by 1 order by 2 desc limit 20;",
    ),
    (
        "process_detached run 일자별",
        "select date_trunc('day', created_at)::date d, count(*), count(distinct process_pid) "
        "from heartbeat_runs where error_code = 'process_detached' group by 1 order by 1;",
    ),
    (
        "'is still alive' 이벤트 일자별 (= 고아인데 살려둔 사건)",
        "select date_trunc('day', created_at)::date d, count(*) "
        "from heartbeat_run_events where message like '%is still alive%' group by 1 order by 1;",
    ),
    (
        "'Process lost' 이벤트 일자별 (= 이미 죽어 있던 경우)",
        "select date_trunc('day', created_at)::date d, count(*) "
        "from heartbeat_run_events where message like 'Process lost%' group by 1 order by 1;",
    ),
    (
        "pid 기록된 런 / 전체 런 (최근 14일)",
        "select date_trunc('day', created_at)::date d, "
        "count(*) filter (where process_pid is not null) with_pid, count(*) total "
        "from heartbeat_runs where created_at > now() - interval '14 days' group by 1 order by 1;",
    ),
    (
        "지금도 status=running 인 오래된 런 (실행 슬롯 영구 점유 후보)",
        "select id, agent_id, process_pid, error_code, started_at "
        "from heartbeat_runs where status = 'running' order by started_at limit 20;",
    ),
]


def run(db: str, sql: str) -> str:
    p = subprocess.run(
        [PSQL, "-h", "127.0.0.1", "-p", PORT, "-U", USER, "-d", db, "-X", "-A", "-F", "|", "-c", sql],
        capture_output=True,
        text=True,
        env={**os.environ, "PGPASSWORD": PASSWORD},
    )
    return p.stdout.strip() if p.returncode == 0 else f"ERR: {p.stderr.strip()[:300]}"


def main() -> int:
    db = sys.argv[1] if len(sys.argv) > 1 else "paperclip"
    for title, sql in QUERIES:
        print(f"== {title} ==")
        print(run(db, sql) or "(0행)")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
