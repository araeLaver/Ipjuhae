#!/usr/bin/env python3
"""Paperclip API POST/PATCH 헬퍼. 본문은 JSON 파일로 받는다.

셸 인용 가드가 힙 리터럴 JSON 을 막고 RTK 가 curl 의 JSON 을 뭉개므로,
경로 + 파일만 인자로 받는다.

용법: python3 scripts/ops/paperclip-post.py <경로> <json파일> [--method PATCH]
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    path, payload_path = sys.argv[1], sys.argv[2]
    method = sys.argv[sys.argv.index("--method") + 1] if "--method" in sys.argv else "POST"

    api = os.environ["PAPERCLIP_API_URL"]
    key = os.environ["PAPERCLIP_API_KEY"]
    run_id = os.environ.get("PAPERCLIP_RUN_ID", "")

    with open(payload_path, encoding="utf-8") as fh:
        payload = fh.read()

    req = urllib.request.Request(
        api + path,
        data=payload.encode("utf-8"),
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "X-Paperclip-Run-Id": run_id,
        },
    )
    try:
        resp = json.load(urllib.request.urlopen(req))
        print("OK", json.dumps(resp, ensure_ascii=False)[:600])
        return 0
    except urllib.error.HTTPError as err:
        print("ERR", err.code, err.read().decode()[:600])
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
