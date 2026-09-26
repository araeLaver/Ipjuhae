#!/usr/bin/env python3
"""ops_deadmans_switch.py 판정기를 실제 네트워크로 검증한다.

DOW-1180 의 교훈: 설정만 하고 한 번도 울려보지 않은 감시는 감시가 아니다.
여기서는 통과 경로와 **실패 경로 4종**을 전부 실제로 밟는다.
"""
import json
import os
import subprocess
import sys
import tempfile

JUDGE = "/Volumes/WorkDrive/Develop/02_Ipjuhae/.github/scripts/ops_deadmans_switch.py"
GH = "/opt/homebrew/bin/gh"
REAL_GIST = "579dcda270d632ad3ca1cb7049b5284f"
OWNER = "araeLaver"

results = []


def run(name, env, expect_rc):
    e = dict(os.environ)
    e.pop("GITHUB_STEP_SUMMARY", None)
    e.update(env)
    p = subprocess.run([sys.executable, JUDGE], capture_output=True, text=True, env=e, timeout=120)
    ok = p.returncode == expect_rc
    results.append({
        "case": name,
        "pass": ok,
        "expectedRc": expect_rc,
        "gotRc": p.returncode,
        "output": (p.stdout + p.stderr).strip()[-400:],
    })


def make_gist(payload, desc):
    d = tempfile.mkdtemp()
    p = os.path.join(d, "heartbeat.json")
    open(p, "w").write(json.dumps(payload, indent=1) + "\n")
    r = subprocess.run([GH, "gist", "create", p, "--public", "--desc", desc],
                       capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise SystemExit("gist create failed " + r.stderr[:200])
    return r.stdout.strip().rsplit("/", 1)[-1]


def rm_gist(gid):
    subprocess.run([GH, "api", "--method", "DELETE", "/gists/" + gid], capture_output=True, text=True)


base = {"GIST_ID": REAL_GIST, "GIST_OWNER": OWNER, "MAX_AGE_SEC": "1200"}

# 1) 통과: 운영 gist 는 지금 신선하고 alerting=false 여야 한다
run("운영 heartbeat 정상이면 통과", base, 0)

# 2) 실패: 신선도 한도를 1초로 줄이면 낡음으로 잡아야 한다
run("heartbeat 이 낡으면 실패", dict(base, MAX_AGE_SEC="1"), 1)

# 3) 실패: 설정 누락은 통과가 아니다
run("gist id 누락이면 실패", dict(base, GIST_ID=""), 1)
run("gist owner 누락이면 실패", dict(base, GIST_OWNER=""), 1)

# 4) 실패: 없는 gist -> 판정 불가 -> 실패
run("읽을 수 없으면 실패", dict(base, GIST_ID="0" * 32), 1)

# 5) 실패: alerting=true 중계
alert_gid = make_gist(
    {"ts": "2099-01-01T00:00:00.000Z", "lastStatus": 503, "consecutiveFailures": 2, "alerting": True},
    "DOW-1202 judge test throwaway (deleted immediately)",
)
try:
    # ts 가 미래이므로 낡음이 아니라 alerting 으로만 실패해야 한다
    run("alerting=true 면 실패", dict(base, GIST_ID=alert_gid), 1)
    # 미래 ts 자체도 잡히는지 (시계 이상 감지)
    results.append({
        "case": "미래 ts 경고가 출력에 포함",
        "pass": "미래" in results[-1]["output"],
        "expectedRc": 1, "gotRc": 1, "output": results[-1]["output"][-200:],
    })
    # 필드 누락
    bad_gid = make_gist({"ts": "2026-01-01T00:00:00.000Z"}, "DOW-1202 judge test throwaway 2")
    try:
        run("필드 누락이면 실패", dict(base, GIST_ID=bad_gid), 1)
    finally:
        rm_gist(bad_gid)
finally:
    rm_gist(alert_gid)

failed = [r for r in results if not r["pass"]]
print(json.dumps({"cases": results, "failed": len(failed)}, ensure_ascii=False, indent=1))
sys.exit(1 if failed else 0)
