#!/usr/bin/env python3
"""DOW-1272 — launchd(ppid=1) 로 재부모화된 "탈출한 어댑터 자식" 을 찾는다 (읽기 전용).

가설: Paperclip 서버가 죽거나 재시작하면, 서버가 띄운 local adapter 자식
(claude / codex / node CLI) 이 함께 죽지 않고 ppid=1 로 재부모화되어 영구히 남는다.
서버 재시작이 잦을수록 세대마다 고아가 쌓여 `kern.maxprocperuid` 를 잠식한다.

이 스크립트는 그 후보를 실제 명령줄로 지목한다.
"""
from __future__ import annotations

import collections
import subprocess
import sys

# Paperclip 이 띄우는 것으로 알려진 실행체
ADAPTER_MARKERS = (
    "claude",
    "codex",
    "paperclipai",
    "45.paperclipai",
    "PAPERCLIP_",
    "--append-system-prompt",
    "--output-format stream-json",
)
# 데스크톱 앱(사용자 GUI)은 제외 — 이들은 서버 자식이 아니다
GUI_EXCLUDE = (
    "/Applications/",
    "Google Chrome",
    "Brave Browser",
    "Safari",
    "WebKit",
    "Notion",
    "Messages",
)


def rows():
    out = subprocess.run(
        ["/bin/ps", "-axo", "pid=,ppid=,user=,lstart=,etime=,command="],
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    for line in out:
        head = line.split(None, 3)
        if len(head) < 4 or head[2] != "down":
            continue
        pid, ppid, _user, rest = head
        bits = rest.split(None, 6)
        if len(bits) < 7:
            continue
        yield {
            "pid": int(pid),
            "ppid": int(ppid),
            "lstart": " ".join(bits[:5]),
            "etime": bits[5],
            "command": bits[6],
        }


def main() -> int:
    all_rows = list(rows())
    orphans = [r for r in all_rows if r["ppid"] == 1]
    suspects = [
        r
        for r in orphans
        if any(m in r["command"] for m in ADAPTER_MARKERS)
        and not any(x in r["command"] for x in GUI_EXCLUDE)
    ]

    print(f"down 프로세스 {len(all_rows)} / ppid=1 고아 {len(orphans)} / 어댑터 고아 후보 {len(suspects)}")
    print("\n[어댑터 고아 후보 — 명령줄]")
    for r in sorted(suspects, key=lambda x: x["pid"]):
        print(f"  pid {r['pid']:>7} 시작 {r['lstart']} 나이 {r['etime']}")
        print(f"      {r['command'][:200]}")

    print("\n[ppid=1 고아 — 시작 시각별 집계 (버스트 = 서버 세대 교체 흔적)]")
    byts = collections.Counter(r["lstart"] for r in orphans)
    for ts, n in sorted(byts.items(), key=lambda kv: -kv[1])[:15]:
        print(f"  {n:4d}  {ts}")

    if "--verbose" in sys.argv:
        print("\n[ppid=1 고아 전체]")
        for r in sorted(orphans, key=lambda x: x["pid"]):
            print(f"  pid {r['pid']:>7} {r['lstart']}  {r['command'][:160]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
