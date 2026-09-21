import collections
import re
import subprocess
import sys

d = "/Volumes/WorkDrive/Develop/02_Ipjuhae"
target = sys.argv[1] if len(sys.argv) > 1 else "docs"
r = subprocess.run(
    ["node", "scripts/check-public-disclosure-terms.mjs", target],
    cwd=d,
    capture_output=True,
    text=True,
)
print("EXIT", r.returncode)
print(r.stdout.strip())
lines = r.stderr.split("\n")
print(lines[0] if lines else "")

pairs = re.findall(r'^(\S+?):(\d+) "(.+?)" ->', r.stderr, re.M)
by_term = collections.Counter(t for _, _, t in pairs)
by_file = collections.Counter(f for f, _, _ in pairs)
print("\n용어별:")
for k, v in by_term.most_common():
    print("  ", k, v)
print("\n파일수:", len(by_file), " 총건수:", len(pairs))

show = sys.argv[2] if len(sys.argv) > 2 else None
if show:
    print("\n'%s' 상세:" % show)
    i = 1
    while i < len(lines) - 1:
        m = re.match(r'^(\S+?):(\d+) "(.+?)" ->', lines[i])
        if m and m.group(3) == show:
            print("  ", m.group(1) + ":" + m.group(2))
            print("    ", lines[i + 1].strip()[:200])
        i += 2
