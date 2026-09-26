#!/usr/bin/env python3
"""운영 dead-man's-switch 판정기 (DOW-1202).

public gist 의 heartbeat 을 토큰 없이 읽어 두 가지만 본다.

  1. **신선도** — heartbeat 의 ts 가 MAX_AGE_SEC 보다 오래됐으면 실패.
     호스트가 통째로 죽으면 gist 갱신이 멈추므로 이게 dead-man's-switch 본체다.
  2. **경보 상태** — alerting=true 면 실패.
     "연속 2회 이상 비-200" 디바운스는 on-host 워처가 이미 적용해서 내려보낸다
     (DOW-1180 확정 기준). 여기서는 그 판정을 중계할 뿐 다시 계산하지 않는다.

판정 불가(설정 누락·양쪽 읽기 경로 모두 실패)는 **통과가 아니라 실패**로 낸다.
"설정은 되어 있는데 한 번도 울린 적 없는 감시"를 만들지 않기 위한 것이다.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

FILENAME = "heartbeat.json"
REQUIRED_FIELDS = ("ts", "lastStatus", "consecutiveFailures", "alerting")


def fail(msg: str) -> "None":
    print("::error title=ops dead-mans-switch::" + msg)
    summary(msg, ok=False)
    sys.exit(1)


def summary(msg: str, ok: bool) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    icon = "✅" if ok else "🚨"
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write("%s **ops dead-mans-switch**\n\n%s\n" % (icon, msg))
    except OSError:
        pass


def fetch(url: str, accept: "str | None" = None) -> str:
    headers = {"User-Agent": "ops-deadmans-switch"}
    if accept:
        headers["Accept"] = accept
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read(256 * 1024).decode("utf-8", "replace")


def read_heartbeat(gist_id: str, owner: str) -> "tuple[dict, str]":
    """API 우선, raw 폴백. 둘 다 미인증이다.

    api.github.com 은 미인증 시 IP당 60회/시간이고 Actions 러너는 IP를 공유하므로
    rate limit 을 맞을 수 있다. 그때 감시가 죽지 않도록 CDN raw 경로로 떨어진다.
    (raw 는 max-age=300 이라 조금 더 낡게 보일 수 있어 1순위로 두지 않는다.)
    """
    errors = []
    try:
        data = json.loads(fetch("https://api.github.com/gists/" + gist_id, "application/vnd.github+json"))
        files = data.get("files") or {}
        if FILENAME not in files:
            errors.append("api: %s 파일이 gist 에 없음 (있는 것: %s)" % (FILENAME, sorted(files)))
        else:
            return json.loads(files[FILENAME]["content"]), "api"
    except urllib.error.HTTPError as exc:
        errors.append("api: HTTP %s" % exc.code)
    except Exception as exc:
        errors.append("api: %s" % type(exc).__name__)

    raw_url = "https://gist.githubusercontent.com/%s/%s/raw/%s" % (owner, gist_id, FILENAME)
    try:
        return json.loads(fetch(raw_url)), "raw"
    except urllib.error.HTTPError as exc:
        errors.append("raw: HTTP %s" % exc.code)
    except Exception as exc:
        errors.append("raw: %s" % type(exc).__name__)

    fail("heartbeat 을 읽을 수 없습니다 — 판정 불가는 통과가 아닙니다. " + " / ".join(errors))


def main() -> int:
    gist_id = (os.environ.get("GIST_ID") or "").strip()
    owner = (os.environ.get("GIST_OWNER") or "").strip()
    if not gist_id or not owner:
        fail(
            "repo variable 이 비어 있습니다 (OPS_DEADMANS_GIST_ID / OPS_DEADMANS_GIST_OWNER). "
            "설정 누락을 정상으로 넘기면 감시가 허구가 됩니다."
        )
    try:
        max_age = float(os.environ.get("MAX_AGE_SEC") or 1200)
    except ValueError:
        fail("MAX_AGE_SEC 값이 숫자가 아닙니다: %r" % os.environ.get("MAX_AGE_SEC"))

    heartbeat, via = read_heartbeat(gist_id, owner)

    missing = [f for f in REQUIRED_FIELDS if f not in heartbeat]
    if missing:
        fail("heartbeat 필드 누락 %s — 워처가 예상과 다른 형식을 쓰고 있습니다." % missing)

    raw_ts = str(heartbeat["ts"])
    try:
        ts = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
    except ValueError:
        fail("heartbeat ts 를 해석할 수 없습니다: %r" % raw_ts)

    age = (datetime.now(timezone.utc) - ts).total_seconds()
    alerting = bool(heartbeat["alerting"])
    detail = (
        "- 읽은 경로: `%s`\n"
        "- heartbeat ts: `%s` (나이 %.0f초 / 한도 %.0f초)\n"
        "- lastStatus: `%s`\n"
        "- consecutiveFailures: `%s`\n"
        "- alerting: `%s`"
        % (via, raw_ts, age, max_age, heartbeat["lastStatus"], heartbeat["consecutiveFailures"], alerting)
    )
    print(detail)

    problems = []
    if age > max_age:
        problems.append(
            "heartbeat 이 %.0f초 전에 멈췄습니다 (한도 %.0f초). "
            "운영 호스트 또는 워처가 죽었을 가능성이 높습니다." % (age, max_age)
        )
    if age < -300:
        problems.append("heartbeat ts 가 미래입니다 (%.0f초). 호스트 시계를 확인하세요." % -age)
    if alerting:
        problems.append(
            "백업 health 경보가 올라와 있습니다 — `/api/health/backup` 비-200 연속 %s회. "
            "on-host 워처가 이미 임계치 판정을 내린 상태입니다." % heartbeat["consecutiveFailures"]
        )

    if problems:
        for p in problems:
            print("::error title=ops dead-mans-switch::" + p)
        summary("\n".join("- " + p for p in problems) + "\n\n" + detail, ok=False)
        return 1

    summary("heartbeat 정상.\n\n" + detail, ok=True)
    print("OK — heartbeat 신선하고 경보 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
