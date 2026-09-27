#!/usr/bin/env python3
"""DOW-1272 누수 후보 상세 — 좀비 부모 / 고아 셸 / 프로세스 그룹 추적 (읽기 전용)."""
from __future__ import annotations

import collections
import subprocess
import sys

ALL = {}


def load():
    out = subprocess.run(
        ["/bin/ps", "-axo", "pid=,ppid=,pgid=,user=,lstart=,stat=,command="],
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    for line in out:
        parts = line.split(None, 4)
        if len(parts) < 5:
            continue
        pid, ppid, pgid, user, rest = parts
        # lstart is 5 whitespace-separated tokens: "Fri Sep 26 09:12:03 2026"
        bits = rest.split(None, 6)
        if len(bits) < 7:
            continue
        lstart = " ".join(bits[:5])
        stat = bits[5]
        command = bits[6]
        ALL[int(pid)] = {
            "pid": int(pid),
            "ppid": int(ppid),
            "pgid": int(pgid),
            "user": user,
            "lstart": lstart,
            "stat": stat,
            "command": command,
        }


def show(pid, label=""):
    r = ALL.get(pid)
    if not r:
        return f"{label}pid {pid} <없음>"
    return f"{label}pid {r['pid']} ppid {r['ppid']} {r['user']} {r['lstart']} [{r['stat']}] {r['command'][:130]}"


def main():
    load()
    down = [r for r in ALL.values() if r["user"] == "down"]

    print("=== 좀비와 그 부모 ===")
    for r in sorted(down, key=lambda x: x["pid"]):
        if "Z" in r["stat"]:
            print(show(r["pid"], "  Z  "))
            print(show(r["ppid"], "  └부모 "))

    print("\n=== -zsh 시작 시각 분포 ===")
    shells = [r for r in down if r["command"].strip() in {"-zsh", "zsh"}]
    byday = collections.Counter(" ".join(r["lstart"].split()[:3]) for r in shells)
    for day, n in sorted(byday.items()):
        print(f"  {day}: {n}")

    print("\n=== 고아 -zsh (ppid=1) 샘플 20 ===")
    orph = [r for r in shells if r["ppid"] == 1]
    for r in sorted(orph, key=lambda x: x["pid"])[:20]:
        print(show(r["pid"], "  "))
    print(f"  ... 총 {len(orph)}건")

    print("\n=== 고아 -zsh 의 프로세스 그룹 리더 ===")
    pg = collections.Counter(r["pgid"] for r in orph)
    for pgid, n in pg.most_common(10):
        print(f"  pgid {pgid} x{n}  리더: {show(pgid)}")

    print("\n=== ppid=1 로 고아가 된 down 프로세스 이름 분포 ===")
    orphans_all = [r for r in down if r["ppid"] == 1]
    names = collections.Counter(
        r["command"].split(None, 1)[0].rsplit("/", 1)[-1] for r in orphans_all
    )
    for name, n in names.most_common(20):
        print(f"  {n:4d}  {name}")
    print(f"  총 고아 {len(orphans_all)}")


if __name__ == "__main__":
    sys.exit(main())
