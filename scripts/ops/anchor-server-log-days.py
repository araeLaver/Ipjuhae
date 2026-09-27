#!/usr/bin/env python3
"""DOW-1272 — server.log 의 날짜 없는 `[HH:MM:SS]` 에 실제 날짜를 붙인다 (읽기 전용).

server.log 는 **UTC 시각만** 찍고 날짜를 찍지 않는다. 그래서 "04:38 부터 15:23 까지"
같은 문장은 어느 날인지 알 수 없고, 오늘로 오독하기 쉽다. 이 스크립트는
자정 넘김(clock wrap)으로 day index 를 세고, 알려진 UTC 시각의 앵커 문자열
(예: run id) 로 day index → 실제 날짜를 고정한다.

용법:
    python3 scripts/ops/anchor-server-log-days.py <앵커문자열> <앵커UTC ISO>
    예) ... anchor-server-log-days.py 6d7dcaf0 2026-09-27T05:39:47Z
"""
from __future__ import annotations

import datetime as dt
import os
import re
import sys

LOG = os.path.expanduser("~/.paperclip/instances/default/logs/server.log")
TS = re.compile(r"^\[(\d{2}:\d{2}:\d{2})\]")
USED = re.compile(r"(\d+)/(\d+) processes used for")


def scan(path, anchor):
    day = 0
    prev = None
    clock = None
    anchor_day = None
    guard_first = guard_last = None
    restarts = []
    eagain_last = None
    for line in open(path, errors="replace"):
        m = TS.match(line)
        if m:
            c = m.group(1)
            if prev and c < prev:
                day += 1
            prev = c
            clock = (day, c)
        if anchor and anchor in line and anchor_day is None:
            anchor_day = clock
        if "Server listening" in line:
            restarts.append(clock)
        if "EAGAIN" in line and "process budget" in line:
            eagain_last = clock
        u = USED.search(line)
        if u:
            sample = (clock, int(u.group(1)), int(u.group(2)))
            if guard_first is None:
                guard_first = sample
            guard_last = sample
    return {
        "last": (day, prev),
        "anchor": anchor_day,
        "guard_first": guard_first,
        "guard_last": guard_last,
        "eagain_last": eagain_last,
        "restarts": restarts,
    }


def main() -> int:
    anchor = sys.argv[1] if len(sys.argv) > 1 else None
    anchor_utc = sys.argv[2] if len(sys.argv) > 2 else None
    r = scan(LOG, anchor)

    base_date = None
    if anchor and anchor_utc and r["anchor"]:
        t = dt.datetime.strptime(anchor_utc.replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
        base_date = t.date() - dt.timedelta(days=r["anchor"][0])

    def fmt(entry):
        if not entry:
            return "없음"
        if isinstance(entry[0], tuple):
            clock, *rest = entry
        else:
            clock, rest = entry, []
        d, c = clock
        if base_date:
            date = base_date + dt.timedelta(days=d)
            kst = dt.datetime.combine(date, dt.time.fromisoformat(c)) + dt.timedelta(hours=9)
            label = f"{date} {c}Z (KST {kst:%Y-%m-%d %H:%M:%S})"
        else:
            label = f"day{d} {c}Z"
        return label + (f"  used={rest[0]}/{rest[1]}" if rest else "")

    print(f"앵커: {anchor} → {r['anchor']}  기준일 day0 = {base_date}")
    print(f"로그 끝: {fmt(r['last'])}")
    print(f"가드 첫 차단: {fmt(r['guard_first'])}")
    print(f"가드 마지막 차단: {fmt(r['guard_last'])}")
    print(f"EAGAIN 마지막: {fmt(r['eagain_last'])}")
    print("\n[가드 마지막 차단 이후의 서버 재시작]")
    gl = r["guard_last"][0] if r["guard_last"] else (0, "00:00:00")
    for rs in r["restarts"]:
        if rs and rs > gl:
            print(f"  {fmt(rs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
