"""QA: scoped sampler 건전성 + 비밀키 유출 검사 (DOW-1180)."""
import json
import re
import subprocess
from datetime import datetime

EV = "/Volumes/WorkDrive/Develop/_runtime/dow-1170-evidence"

for name in ("scoped-sampler.pid", "sampler.pid"):
    pid = open(f"{EV}/{name}").read().strip()
    out = subprocess.run(
        ["ps", "-o", "pid=,ppid=,etime=,stat=,comm=", "-p", pid],
        capture_output=True, text=True,
    ).stdout.strip()
    print(f"{name} = {pid} -> {out or 'NOT RUNNING'}")

raw = open(f"{EV}/scoped-samples.jsonl").read().splitlines()
samples, bad = [], 0
for line in raw:
    if not line.strip():
        continue
    try:
        samples.append(json.loads(line))
    except Exception:
        bad += 1

print(f"\nscoped samples = {len(samples)}, parse errors = {bad}")
if samples:
    print("keys:", sorted(samples[-1].keys()))
    ts = [s.get("time") or s.get("ts") or s.get("timestamp") for s in samples]
    print("window:", ts[0], "->", ts[-1])

    def parse(t):
        return datetime.fromisoformat(t.replace("Z", "+00:00"))

    gaps = [
        (parse(ts[i + 1]) - parse(ts[i])).total_seconds() / 60 for i in range(len(ts) - 1)
    ]
    if gaps:
        gaps_sorted = sorted(gaps)
        print(
            "gap min/median/max (min):",
            round(gaps_sorted[0], 2),
            round(gaps_sorted[len(gaps) // 2], 2),
            round(gaps_sorted[-1], 2),
            "| >7.5min gaps:",
            sum(1 for g in gaps if g > 7.5),
        )
        span = (parse(ts[-1]) - parse(ts[0])).total_seconds() / 3600
        print(f"observation span = {span:.2f} h / 24 h")

    for key in (
        "leak", "orphanEscapedGroup", "orphans", "orphanRoots", "adapterAttached",
        "adapterOrphaned", "inServerPgid", "subtreeCount", "zombiesApp", "zombiesHost",
        "hostTotal", "serverAlive", "serverPid",
    ):
        vals = [s.get(key) for s in samples if key in s]
        if vals:
            if isinstance(vals[0], list):
                print(f"{key}: first={len(vals[0])} last={len(vals[-1])}")
            else:
                print(f"{key}: first={vals[0]} last={vals[-1]} min={min(vals)} max={max(vals)}")

# 비밀키 유출 검사
text = open(f"{EV}/scoped-samples.jsonl").read()
patterns = {
    "PAPERCLIP_API_KEY": r"PAPERCLIP_API_KEY",
    "JWT_SECRET": r"JWT_SECRET",
    "jwt-ish token": r"eyJ[A-Za-z0-9_-]{20,}",
    "KEY= assignment": r"[A-Z_]*KEY=[^\s\"]{8,}",
    "SECRET= assignment": r"[A-Z_]*SECRET=[^\s\"]{8,}",
}
print("\n=== 비밀키 유출 검사 (scoped-samples.jsonl) ===")
for label, pat in patterns.items():
    hits = re.findall(pat, text)
    print(f"{label}: {len(hits)} hits", (hits[0][:60] if hits else ""))
