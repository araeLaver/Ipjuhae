#!/usr/bin/env python3
"""호스트 프로세스 누수 관측기 (DOW-1272).

읽기 전용. 프로세스 예산 가드(`countDarwinProcessesForUser`)와 동일한 방법으로
`down` 사용자 프로세스를 세고, 누수 후보를 분류해서 출력한다.

용법:
    python3 scripts/ops/inspect-process-leak.py            # 요약
    python3 scripts/ops/inspect-process-leak.py --json     # 기계 판독용
"""
from __future__ import annotations

import collections
import json
import re
import subprocess
import sys

USER = "down"
PS_FIELDS = "pid=,ppid=,user=,etime=,stat=,command="


def read_rows():
    out = subprocess.run(
        ["/bin/ps", "-axo", PS_FIELDS], capture_output=True, text=True
    ).stdout.splitlines()
    rows = []
    for line in out:
        parts = line.split(None, 5)
        if len(parts) < 6:
            continue
        pid, ppid, user, etime, stat, command = parts
        if user != USER:
            continue
        rows.append(
            {
                "pid": int(pid),
                "ppid": int(ppid),
                "etime": etime,
                "stat": stat,
                "command": command,
            }
        )
    return rows


def etime_seconds(etime: str) -> int:
    # [[dd-]hh:]mm:ss
    days = 0
    if "-" in etime:
        d, etime = etime.split("-", 1)
        days = int(d)
    bits = [int(x) for x in etime.split(":")]
    while len(bits) < 3:
        bits.insert(0, 0)
    h, m, s = bits
    return days * 86400 + h * 3600 + m * 60 + s


def basename(command: str) -> str:
    first = command.split(None, 1)[0]
    if first.startswith("("):
        return first
    return first.rsplit("/", 1)[-1]


def maxprocperuid() -> int:
    out = subprocess.run(
        ["sysctl", "-n", "kern.maxprocperuid"], capture_output=True, text=True
    )
    return int(out.stdout.strip() or 0)


def main() -> int:
    rows = read_rows()
    limit = maxprocperuid()
    by_name = collections.Counter(basename(r["command"]) for r in rows)
    zombies = [r for r in rows if "Z" in r["stat"]]
    shells = [r for r in rows if basename(r["command"]) in {"-zsh", "zsh", "-bash", "bash"}]
    by_parent = collections.Counter(r["ppid"] for r in rows)

    # 부모 pid 별 명령어 이름 (누가 자식을 쌓는지)
    pid_to_cmd = {r["pid"]: r["command"] for r in rows}

    result = {
        "count": len(rows),
        "limit": limit,
        "pct": round(100 * len(rows) / limit, 1) if limit else None,
        "zombies": [
            {"pid": r["pid"], "ppid": r["ppid"], "command": r["command"][:120]}
            for r in zombies
        ],
        "top_names": by_name.most_common(15),
        "top_parents": [
            {
                "ppid": ppid,
                "children": n,
                "parent_command": pid_to_cmd.get(ppid, "<not a down process>")[:120],
            }
            for ppid, n in by_parent.most_common(10)
        ],
        "shells": {
            "count": len(shells),
            "by_age_bucket": dict(
                collections.Counter(
                    (
                        ">1d"
                        if etime_seconds(r["etime"]) > 86400
                        else ">1h"
                        if etime_seconds(r["etime"]) > 3600
                        else "<1h"
                    )
                    for r in shells
                )
            ),
            "by_parent": collections.Counter(r["ppid"] for r in shells).most_common(10),
        },
        "long_lived": sum(1 for r in rows if etime_seconds(r["etime"]) > 86400),
    }

    if "--json" in sys.argv:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    print(f"down 프로세스 {result['count']} / 한도 {limit} ({result['pct']}%)")
    print(f"좀비(<defunct>) {len(zombies)}건, 1일 이상 생존 {result['long_lived']}건")
    print("\n[상위 프로세스 이름]")
    for name, n in result["top_names"]:
        print(f"  {n:4d}  {name}")
    print("\n[자식을 가장 많이 매단 부모]")
    for p in result["top_parents"]:
        print(f"  ppid {p['ppid']:>7}  자식 {p['children']:3d}  {p['parent_command']}")
    print("\n[셸 세션]")
    print(f"  총 {result['shells']['count']}  나이 분포 {result['shells']['by_age_bucket']}")
    for ppid, n in result["shells"]["by_parent"]:
        print(f"  ppid {ppid:>7}  셸 {n:3d}  {pid_to_cmd.get(ppid, '<non-down>')[:100]}")
    if zombies:
        print("\n[좀비 상세]")
        for z in result["zombies"]:
            print(f"  pid {z['pid']:>7} ppid {z['ppid']:>7}  {z['command']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
