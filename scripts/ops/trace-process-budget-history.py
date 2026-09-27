#!/usr/bin/env python3
"""DOW-1272 — server.log 에서 프로세스 예산 사용량 궤적을 뽑는다 (읽기 전용).

가드 메시지에 박혀 있는 `N/M processes used` 값을 시간순으로 모아
증가율과 급감(배수) 시점을 찾는다. 누수원 후보를 시각으로 좁히는 용도.
"""
from __future__ import annotations

import os
import re
import sys

LOG = os.path.expanduser("~/.paperclip/instances/default/logs/server.log")

# 예: "2664/2666 processes used for down (100%), 2 free"
USED = re.compile(r"(\d+)/(\d+) processes used for (\w+) \((\d+)%\), (\d+) free")
# 로그 줄 앞머리 타임스탬프 — server.log 는 날짜 없이 `[HH:MM:SS]` 만 찍는다
TS = re.compile(r"^\[(\d{2}:\d{2}:\d{2})\]")


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else LOG
    samples = []
    clock = "?"
    with open(path, "r", errors="replace") as fh:
        for line in fh:
            t = TS.match(line)
            if t:
                clock = t.group(1)
            m = USED.search(line)
            if not m:
                continue
            samples.append((clock, int(m.group(1)), int(m.group(2))))

    if not samples:
        print("프로세스 예산 샘플 없음")
        return 0

    print(f"샘플 {len(samples)}건  {samples[0][0]} → {samples[-1][0]}")
    print(f"첫 값 {samples[0][1]}  마지막 값 {samples[-1][1]}  한도 {samples[0][2]}")

    # 시(hour) 단위로 최소/최대
    print("\n[시간대별 사용량]")
    cur = None
    lo = hi = None
    for t, used, _ in samples:
        hour = t[:13]
        if hour != cur:
            if cur is not None:
                print(f"  {cur}  min {lo}  max {hi}")
            cur, lo, hi = hour, used, used
        else:
            lo, hi = min(lo, used), max(hi, used)
    if cur is not None:
        print(f"  {cur}  min {lo}  max {hi}")

    # 급감 구간 (직전 대비 100 이상 감소)
    print("\n[급감 구간 (직전 대비 -100 이상)]")
    prev = None
    drops = 0
    for t, used, _ in samples:
        if prev is not None and used - prev[1] <= -100:
            print(f"  {prev[0]} {prev[1]} → {t} {used}  ({used - prev[1]})")
            drops += 1
        prev = (t, used)
    if not drops:
        print("  없음 — 단조 증가만 있었고 배수는 로그 관측 구간 밖에서 일어났다")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
