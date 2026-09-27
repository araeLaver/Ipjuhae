#!/usr/bin/env python3
"""DOW-1272 — down 사용자 프로세스를 `이름 x 나이` 로 교차 집계한다 (읽기 전용).

누수 서명 찾기용. 한 이름이 여러 나이 구간에 고르게 퍼져 있으면
"계속 생겨나고 회수되지 않는" 계열이다. 한 나이 구간에 몰려 있으면
부팅/로그인 때의 1회성 버스트이지 누수가 아니다.
"""
from __future__ import annotations

import collections
import json
import subprocess
import sys

BUCKETS = [
    (300, "<5m"),
    (3600, "<1h"),
    (6 * 3600, "<6h"),
    (86400, "<1d"),
    (3 * 86400, "<3d"),
    (float("inf"), ">=3d"),
]
ORDER = [b[1] for b in BUCKETS]


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


def bucket(sec: int) -> str:
    for limit, name in BUCKETS:
        if sec < limit:
            return name
    return ORDER[-1]


def basename(command: str) -> str:
    first = command.split(None, 1)[0]
    return first.rsplit("/", 1)[-1] if not first.startswith("(") else first


def main() -> int:
    out = subprocess.run(
        ["/bin/ps", "-axo", "user=,etime=,stat=,command="], capture_output=True, text=True
    ).stdout.splitlines()
    table = collections.defaultdict(collections.Counter)
    total = 0
    for line in out:
        parts = line.split(None, 3)
        if len(parts) < 4 or parts[0] != "down":
            continue
        total += 1
        table[basename(parts[3])][bucket(etime_seconds(parts[1]))] += 1

    if "--json" in sys.argv:
        print(json.dumps({k: dict(v) for k, v in table.items()}, ensure_ascii=False, indent=2))
        return 0

    print(f"down 프로세스 {total}건 — 이름 x 나이 교차표 (상위 25)")
    header = "  " + "".join(f"{b:>7}" for b in ORDER) + "   이름"
    print(header)
    rows = sorted(table.items(), key=lambda kv: -sum(kv[1].values()))[:25]
    for name, counter in rows:
        cells = "".join(f"{counter.get(b, 0):>7}" for b in ORDER)
        print(f"  {cells}   {name}")

    print("\n[여러 나이 구간에 퍼진 계열 = 누수 후보]")
    for name, counter in sorted(table.items(), key=lambda kv: -sum(kv[1].values())):
        spread = sum(1 for b in ORDER if counter.get(b, 0) > 0)
        if spread >= 3 and sum(counter.values()) >= 5:
            print(f"  {name}: 총 {sum(counter.values())}, 구간 {spread}개 {dict(counter)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
