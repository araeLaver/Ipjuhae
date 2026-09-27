#!/usr/bin/env python3
"""DOW-1272 — Paperclip 서버 프로세스의 자손 트리를 센다 (읽기 전용).

프로세스 누수의 소유자를 확정하기 위한 도구.
- 서버 프로세스를 찾고
- 그 자손 전체를 이름별/나이별로 집계하고
- 부모가 죽어 ppid=1 로 재부모화된 "탈출한 자손" 후보도 따로 센다.

`--watch N` 을 주면 N 초 간격으로 반복 측정해 증가율을 보여준다.
"""
from __future__ import annotations

import collections
import subprocess
import sys
import time

SERVER_HINTS = ("paperclip", "45.paperclipai")


def snapshot():
    out = subprocess.run(
        ["/bin/ps", "-axo", "pid=,ppid=,user=,etime=,command="], capture_output=True, text=True
    ).stdout.splitlines()
    procs = {}
    for line in out:
        parts = line.split(None, 4)
        if len(parts) < 5:
            continue
        pid, ppid, user, etime, command = parts
        procs[int(pid)] = {
            "pid": int(pid),
            "ppid": int(ppid),
            "user": user,
            "etime": etime,
            "command": command,
        }
    return procs


def etime_seconds(etime: str) -> int:
    days = 0
    if "-" in etime:
        d, etime = etime.split("-", 1)
        days = int(d)
    bits = [int(x) for x in etime.split(":")]
    while len(bits) < 3:
        bits.insert(0, 0)
    h, m, s = bits
    return days * 86400 + h * 3600 + m * 60 + s


def find_servers(procs):
    out = []
    for r in procs.values():
        c = r["command"]
        if any(h in c for h in SERVER_HINTS) and ("node" in c or "tsx" in c):
            out.append(r)
    return out


def descendants(procs, roots):
    children = collections.defaultdict(list)
    for r in procs.values():
        children[r["ppid"]].append(r["pid"])
    seen = set()
    stack = list(roots)
    while stack:
        pid = stack.pop()
        for c in children.get(pid, []):
            if c in seen:
                continue
            seen.add(c)
            stack.append(c)
    return seen


def basename(command: str) -> str:
    first = command.split(None, 1)[0]
    return first.rsplit("/", 1)[-1] if not first.startswith("(") else first


def report(procs):
    down = [r for r in procs.values() if r["user"] == "down"]
    servers = find_servers(procs)
    print(f"down 프로세스 총 {len(down)}건")
    print(f"Paperclip 서버 후보 {len(servers)}건")
    for s in servers:
        print(f"  pid {s['pid']} 나이 {s['etime']}  {s['command'][:140]}")
    if not servers:
        return len(down), 0
    kids = descendants(procs, [s["pid"] for s in servers])
    kid_rows = [procs[p] for p in kids if procs[p]["user"] == "down"]
    print(f"\n서버 자손(down) {len(kid_rows)}건")
    names = collections.Counter(basename(r["command"]) for r in kid_rows)
    for name, n in names.most_common(15):
        print(f"  {n:4d}  {name}")
    # 서버보다 오래 산 down 프로세스 = 이전 서버 세대의 잔존 후보
    if servers:
        server_age = max(etime_seconds(s["etime"]) for s in servers)
        older = [r for r in down if etime_seconds(r["etime"]) > server_age]
        print(f"\n서버보다 오래 산 down 프로세스 {len(older)}건 (서버 나이 {server_age}s)")
        onames = collections.Counter(basename(r["command"]) for r in older)
        for name, n in onames.most_common(10):
            print(f"  {n:4d}  {name}")
    return len(down), len(kid_rows)


def main() -> int:
    if "--watch" in sys.argv:
        interval = int(sys.argv[sys.argv.index("--watch") + 1])
        rounds = int(sys.argv[sys.argv.index("--rounds") + 1]) if "--rounds" in sys.argv else 5
        base = None
        for i in range(rounds):
            procs = snapshot()
            down = sum(1 for r in procs.values() if r["user"] == "down")
            servers = find_servers(procs)
            kids = (
                len(
                    [
                        p
                        for p in descendants(procs, [s["pid"] for s in servers])
                        if procs[p]["user"] == "down"
                    ]
                )
                if servers
                else 0
            )
            if base is None:
                base = (down, kids)
            print(
                f"[{i}] t+{i*interval:>5}s  down={down} ({down-base[0]:+d})  "
                f"서버자손={kids} ({kids-base[1]:+d})",
                flush=True,
            )
            if i < rounds - 1:
                time.sleep(interval)
        return 0
    report(snapshot())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
