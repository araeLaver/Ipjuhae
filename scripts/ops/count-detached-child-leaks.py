#!/usr/bin/env python3
"""DOW-1272 — server.log 에서 "고아가 됐지만 살아 있는 자식" 사건을 센다 (읽기 전용).

heartbeat.ts 의 reapOrphanedRuns 는 이전 서버 세대가 남긴 자식 pid 가 아직
살아 있으면 run 을 `process_detached` 로 표시하고 **그대로 둔다**. 죽이지 않는다.
그 순간마다 프로세스 하나가 영구히 호스트에 남는다. 이 스크립트는 그 사건을
날짜별로 집계해 누수량을 수치로 보인다.

server.log 는 UTC 시각만 찍고 날짜를 안 찍으므로, 자정 넘김으로 day index 를
세고 앵커(run id + 실제 UTC 시각)로 실제 날짜를 고정한다.
"""
from __future__ import annotations

import collections
import datetime as dt
import os
import re
import sys

LOG = os.path.expanduser("~/.paperclip/instances/default/logs/server.log")
TS = re.compile(r"^\[(\d{2}:\d{2}:\d{2})\]")
DETACHED = re.compile(r"child pid (\d+) is still alive")
LOST = re.compile(r"Process lost -- child pid (\d+) is no longer running")
RESTART = "Server listening"


def main() -> int:
    anchor = sys.argv[1] if len(sys.argv) > 1 else "6d7dcaf0"
    anchor_utc = sys.argv[2] if len(sys.argv) > 2 else "2026-09-27T05:39:47Z"

    day = 0
    prev = None
    anchor_day = None
    detached_by_day = collections.Counter()
    detached_pids = collections.defaultdict(set)
    lost_by_day = collections.Counter()
    restarts_by_day = collections.Counter()

    for line in open(LOG, errors="replace"):
        m = TS.match(line)
        if m:
            c = m.group(1)
            if prev and c < prev:
                day += 1
            prev = c
        if anchor in line and anchor_day is None:
            anchor_day = day
        if RESTART in line:
            restarts_by_day[day] += 1
        d = DETACHED.search(line)
        if d:
            detached_by_day[day] += 1
            detached_pids[day].add(d.group(1))
        l = LOST.search(line)
        if l:
            lost_by_day[day] += 1

    base = None
    if anchor_day is not None:
        t = dt.datetime.strptime(anchor_utc.replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
        base = t.date() - dt.timedelta(days=anchor_day)

    def label(d):
        return str(base + dt.timedelta(days=d)) if base else f"day{d}"

    print("날짜(UTC)   재시작  고아생존(사건)  고아생존(고유pid)  사망확인")
    total_pid = set()
    for d in range(day + 1):
        r = restarts_by_day.get(d, 0)
        de = detached_by_day.get(d, 0)
        up = len(detached_pids.get(d, ()))
        lo = lost_by_day.get(d, 0)
        total_pid |= detached_pids.get(d, set())
        if r or de or lo:
            print(f"{label(d):<12}{r:>6}{de:>15}{up:>18}{lo:>10}")
    print(f"\n고아 생존 고유 pid 총계: {len(total_pid)}")
    print(f"사망 확인(Process lost) 총계: {sum(lost_by_day.values())}")
    print(f"서버 재시작 총계: {sum(restarts_by_day.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
