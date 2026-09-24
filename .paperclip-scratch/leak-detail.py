"""QA: 수정 전 기준선의 leak/고아 상세 (DOW-1180)."""
import json
from collections import Counter

EV = "/Volumes/WorkDrive/Develop/_runtime/dow-1170-evidence"
samples = [json.loads(l) for l in open(f"{EV}/scoped-samples.jsonl") if l.strip()]

nz = [s for s in samples if s.get("leak")]
print(f"leak>0 인 샘플: {len(nz)}/{len(samples)}")
for s in nz:
    print(" ", s["time"], "leak=", s["leak"], "orphans=", s["orphans"], "zombiesApp=", s["zombiesApp"])

print("\n마지막 샘플 원본:")
last = samples[-1]
print(json.dumps(last, ensure_ascii=False, indent=1)[:2500])

# 고아 뿌리 명령 분포
cmds = Counter()
for s in samples:
    roots = s.get("orphanRoots")
    if isinstance(roots, list):
        for r in roots:
            if isinstance(r, dict):
                cmds[str(r.get("cmd") or r.get("command"))[:70]] += 1
print("\n고아 뿌리 명령 빈도(샘플 누적):")
for c, n in cmds.most_common(10):
    print(f"  {n:3d}  {c}")
