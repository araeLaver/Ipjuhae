#!/usr/bin/env python3
"""운영 dead-man's-switch 판정기 (DOW-1202).

public gist 의 heartbeat 을 토큰 없이 읽어 두 가지만 본다.

  1. **신선도** — heartbeat 의 ts 가 MAX_AGE_SEC 보다 오래됐으면 경보.
     호스트가 통째로 죽으면 gist 갱신이 멈추므로 이게 dead-man's-switch 본체다.
  2. **경보 상태** — alerting=true 면 경보.
     "연속 2회 이상 비-200" 디바운스는 on-host 워처가 이미 적용해서 내려보낸다
     (DOW-1180 확정 기준). 여기서는 그 판정을 중계할 뿐 다시 계산하지 않는다.

판정 불가(설정 누락·양쪽 읽기 경로 모두 실패)는 **통과가 아니라 경보**로 낸다.
"설정은 되어 있는데 한 번도 울린 적 없는 감시"를 만들지 않기 위한 것이다.

이 스크립트는 판정만 하고 통지하지 않는다. 판정 결과를 GITHUB_OUTPUT 으로
내보내고, 통지(GitHub Issue 개설/종결)는 워크플로가 맡는다.

  status    ok | alert
  headline  한 줄 요약 (이슈 제목에 쓰인다)
  detail    마크다운 본문

**run 실패 알림에 기대지 않는 이유**: 이 계정의 알림 수신함에는 워크플로 실행
알림이 단 한 건도 도착한 적이 없다(표본 45건 전부 PullRequest). 반면 Issue/PR
알림은 도착한다. 그래서 통지를 Issue 경로로 옮겼다. (DOW-1202 실측)
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


def emit(status: str, headline: str, detail: str) -> None:
    """판정 결과를 워크플로에 넘긴다. 통지는 워크플로가 한다."""
    path = os.environ.get("GITHUB_OUTPUT")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write("status=%s\n" % status)
            fh.write("headline=%s\n" % headline.replace("\n", " ").strip())
            fh.write("detail<<OPS_EOF_D\n%s\nOPS_EOF_D\n" % detail)
    except OSError:
        pass


def summary(msg: str, ok: bool) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    icon = "OK" if ok else "ALERT"
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write("**ops dead-mans-switch: %s**\n\n%s\n" % (icon, msg))
    except OSError:
        pass


def fail(msg: str) -> "None":
    print("::error title=ops dead-mans-switch::" + msg)
    summary(msg, ok=False)
    emit("alert", msg, "- " + msg)
    sys.exit(1)


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
            "설정이 비어 있습니다 (secrets.OPS_DEADMANS_GIST_ID / vars.OPS_DEADMANS_GIST_OWNER). "
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
        "- alerting: `%s`\n"
        "- 판정 시각: `%s`"
        % (
            via,
            raw_ts,
            age,
            max_age,
            heartbeat["lastStatus"],
            heartbeat["consecutiveFailures"],
            alerting,
            datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        )
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
        body = "\n".join("- " + p for p in problems) + "\n\n" + detail
        summary(body, ok=False)
        emit("alert", problems[0], body)
        return 1

    summary("heartbeat 정상.\n\n" + detail, ok=True)
    emit("ok", "heartbeat 정상", detail)
    print("OK — heartbeat 신선하고 경보 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
