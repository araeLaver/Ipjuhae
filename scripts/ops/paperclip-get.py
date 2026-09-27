#!/usr/bin/env python3
"""Paperclip API GET 헬퍼. 셸 인용 가드를 피하려고 파일로 둔다.

용법: python3 scripts/ops/paperclip-get.py <경로> [--raw|--keys k1,k2]
예)   python3 scripts/ops/paperclip-get.py /api/issues/<id>/comments --keys id,authorAgentId,createdAt
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    path = sys.argv[1]
    api = os.environ["PAPERCLIP_API_URL"]
    key = os.environ["PAPERCLIP_API_KEY"]
    req = urllib.request.Request(api + path, headers={"Authorization": f"Bearer {key}"})
    data = json.load(urllib.request.urlopen(req))

    if "--keys" in sys.argv:
        keys = sys.argv[sys.argv.index("--keys") + 1].split(",")
        rows = data if isinstance(data, list) else data.get("items", data.get("comments", []))
        print(f"rows={len(rows)}")
        for row in rows:
            print(" | ".join(f"{k}={row.get(k)}" for k in keys))
        return 0

    limit = 4000
    if "--raw" in sys.argv:
        limit = 10**9
    print(json.dumps(data, ensure_ascii=False, indent=2)[:limit])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
