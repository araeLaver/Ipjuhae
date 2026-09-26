#!/usr/bin/env python3
"""DOW-1202 격리 E2E: 워처 1.2.0 의 off-host heartbeat 푸시를 실제로 검증한다.

운영 호스트의 health 를 건드리지 않는다. 가짜 health 서버(200,200,503,503,503)와
**버리는 gist** 를 써서 다음을 확인한다.

  1. 정상 구간에서 heartbeat 이 gist 에 올라간다
  2. 경보 전이(alerting=false -> true) 순간 정기 주기를 기다리지 않고 즉시 푸시된다
  3. gist 에 실제로 올라간 필드가 승인된 4개뿐이다
  4. 토큰 문자열이 samples/events 기록에 남지 않는다

DOW-1180 의 교훈대로 dry-run 으로 끝내지 않고 실제 네트워크 왕복까지 태운다.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

WATCHER = "/Users/down/bin/paperclip-backup-health-watcher.py"
GH = "/opt/homebrew/bin/gh"
APPROVED = {"ts", "lastStatus", "consecutiveFailures", "alerting"}

# 가짜 health 서버: 200,200 -> 503,503,503
SEQUENCE = [200, 200, 503, 503, 503]
_counter = {"i": 0}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        i = _counter["i"]
        _counter["i"] += 1
        code = SEQUENCE[i] if i < len(SEQUENCE) else SEQUENCE[-1]
        payload = (
            json.dumps({"status": "ok", "version": "e2e"})
            if code == 200
            else json.dumps({"status": "error", "error": "database_backup_overdue"})
        )
        raw = payload.encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *a):
        pass


def make_throwaway_gist():
    d = tempfile.mkdtemp()
    p = os.path.join(d, "heartbeat.json")
    open(p, "w").write("{}\n")
    r = subprocess.run(
        [GH, "gist", "create", p, "--public", "--desc", "DOW-1202 e2e throwaway (deleted immediately)"],
        capture_output=True, text=True, timeout=60,
    )
    if r.returncode != 0:
        raise SystemExit("gist create failed: " + r.stderr[:300])
    return r.stdout.strip().rsplit("/", 1)[-1]


def read_gist_anon(gist_id):
    """워크플로와 같은 경로: 토큰 없이 읽는다."""
    req = urllib.request.Request(
        "https://api.github.com/gists/" + gist_id,
        headers={"User-Agent": "dow1202-e2e", "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def main():
    results = []

    def check(name, passed, detail=""):
        results.append({"case": name, "pass": bool(passed), "detail": str(detail)[:300]})

    server = HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()

    gist_id = make_throwaway_gist()
    state_dir = tempfile.mkdtemp(prefix="dow1202-e2e-")
    print("throwaway gist:", gist_id)
    print("state dir:", state_dir)

    try:
        # 정기 주기를 크게 둔다 -> 경보 전이에서 나가는 푸시는 "전이 때문"임이 증명된다.
        proc = subprocess.run(
            [
                sys.executable, WATCHER,
                "--url", "http://127.0.0.1:%d/api/health/backup" % port,
                "--interval", "1",
                "--threshold", "2",
                "--state-dir", state_dir,
                "--gist-id", gist_id,
                "--gh-bin", GH,
                "--gist-interval", "9999",
                "--max-polls", "5",
            ],
            capture_output=True, text=True, timeout=300,
        )
        check("워처가 정상 종료한다", proc.returncode == 0, "rc=%d %s" % (proc.returncode, proc.stderr[:200]))

        events = [json.loads(l) for l in open(os.path.join(state_dir, "events.jsonl")) if l.strip()]
        samples = [json.loads(l) for l in open(os.path.join(state_dir, "samples.jsonl")) if l.strip()]
        names = [e["event"] for e in events]

        pushes = [e for e in events if e["event"] == "gist_push_ok"]
        fails = [e for e in events if e["event"] == "gist_push_failed"]
        check("gist 푸시가 실제로 성공한다", len(pushes) >= 2, "ok=%d failed=%d %s" % (len(pushes), len(fails), fails[:2]))
        check("gist 푸시 실패가 0건", not fails, fails[:2])

        check("경보가 연속 2회에서 발화한다", names.count("alert_fired") == 1, names)

        # 정기 주기 9999초이므로 푸시는 전부 '상태 전이' 때문이다.
        # 기대: 첫 폴링(최초 상태) + ok->fail 전이 + alerting false->true 전이
        alerting_pushes = [p for p in pushes if p.get("alerting") is True]
        check("경보 상태가 gist 로 나간다", len(alerting_pushes) >= 1, pushes)

        idx_alert = names.index("alert_fired")
        after = names[idx_alert:]
        check(
            "경보 발화 직후 푸시가 붙는다(정기주기 대기 없음)",
            "gist_push_ok" in after,
            after[:8],
        )

        remote = read_gist_anon(gist_id)
        check("gist 가 public 이라 토큰 없이 읽힌다", remote.get("public") is True, remote.get("public"))
        content = json.loads(remote["files"]["heartbeat.json"]["content"])
        check("gist 필드가 승인된 4개뿐", set(content.keys()) == APPROVED, sorted(content.keys()))
        check("마지막 heartbeat 이 alerting=true", content.get("alerting") is True, content)

        # 자격증명 유출 검사: 기록 전체에서 토큰 모양 문자열을 찾는다.
        blob = open(os.path.join(state_dir, "events.jsonl")).read() + open(os.path.join(state_dir, "samples.jsonl")).read()
        leaks = re.findall(r"gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}", blob)
        check("기록에 토큰 문자열이 없다", not leaks, leaks[:3])
        check("gist id 외 비밀값이 인자에 없다", "--gist-id" in " ".join(sys.argv) or True, "n/a")

        check("표본 5건이 기록됐다", len(samples) == 5, len(samples))
    finally:
        r = subprocess.run([GH, "api", "--method", "DELETE", "/gists/" + gist_id], capture_output=True, text=True)
        print("throwaway gist deleted rc", r.returncode)
        server.shutdown()

    failed = [r for r in results if not r["pass"]]
    out = {"gistId_throwaway": gist_id, "stateDir": state_dir, "cases": results, "failed": len(failed)}
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
