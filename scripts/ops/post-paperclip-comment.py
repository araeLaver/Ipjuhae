#!/usr/bin/env python3
"""Paperclip 이슈에 마크다운 파일 내용을 코멘트로 올린다.

curl 은 RTK 가 JSON 을 뭉개고, 셸 인용 가드가 힙 리터럴을 막는다.
그래서 파일 경로만 받아서 urllib 로 보낸다.

용법: python3 scripts/ops/post-paperclip-comment.py <issueId> <본문파일>
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
    issue_id, body_path = sys.argv[1], sys.argv[2]
    api = os.environ["PAPERCLIP_API_URL"]
    key = os.environ["PAPERCLIP_API_KEY"]
    run_id = os.environ.get("PAPERCLIP_RUN_ID", "")

    with open(body_path, encoding="utf-8") as fh:
        body = fh.read()

    req = urllib.request.Request(
        f"{api}/api/issues/{issue_id}/comments",
        data=json.dumps({"body": body}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "X-Paperclip-Run-Id": run_id,
        },
    )
    try:
        resp = json.load(urllib.request.urlopen(req))
        print("OK", resp.get("id"))
        return 0
    except urllib.error.HTTPError as err:
        print("ERR", err.code, err.read().decode()[:500])
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
