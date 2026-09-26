#!/usr/bin/env python3
"""Paperclip API 호출 헬퍼.

RTK 프록시가 curl JSON을 뭉개기 때문에 python3 urllib 경유로만 호출한다.

사용법:
    python3 scripts/stats/pcapi.py GET /api/agents/me
    echo '{"status":"done"}' | python3 scripts/stats/pcapi.py PATCH /api/issues/<id>
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ["PAPERCLIP_API_URL"]
KEY = os.environ["PAPERCLIP_API_KEY"]
RUN = os.environ.get("PAPERCLIP_RUN_ID", "")


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", "Bearer " + KEY)
    req.add_header("Content-Type", "application/json")
    if RUN:
        req.add_header("X-Paperclip-Run-Id", RUN)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    method, path = sys.argv[1], sys.argv[2]
    body = None
    if not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            body = json.loads(raw)
    status, result = call(method, path, body)
    print(status)
    if isinstance(result, (dict, list)):
        print(json.dumps(result, ensure_ascii=False, indent=1))
    else:
        print(result)


if __name__ == "__main__":
    main()
