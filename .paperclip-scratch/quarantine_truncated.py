"""잘린 덤프를 판별해 .truncated로 격리한다 (DOW-1171). --apply 없으면 보고만 한다."""
import os
import re
import sys
import time

DIR = "/Volumes/WorkDrive/Develop/_runtime/paperclip-home/instances/default/data/backups"
NAME = re.compile(r"^paperclip-(\d{8})-(\d{6})\.sql$")
TAIL = re.compile(r"\nCOMMIT;\n(?:--> statement-breakpoint|-- paperclip statement breakpoint [0-9a-f-]{36})\s*$")
# 사건 구간: 09-03 10:58 (첫 잘린 덤프) ~ 09-21 09:20 (OOM 수정 투입 직전)
WINDOW = ("20260903-105800", "20260921-092100")
# 활성 백업을 건드리지 않기 위한 안전 여유.
MIN_AGE_SECONDS = 6 * 3600

apply = "--apply" in sys.argv
now = time.time()
complete, truncated, skipped = [], [], []

for name in sorted(os.listdir(DIR)):
    m = NAME.match(name)
    if not m:
        continue
    stamp = m.group(1) + "-" + m.group(2)
    path = os.path.join(DIR, name)
    st = os.stat(path)
    with open(path, "rb") as fh:
        length = min(256, st.st_size)
        fh.seek(st.st_size - length)
        ok = bool(TAIL.search(fh.read(length).decode("utf8", "replace")))
    if ok:
        complete.append((name, st.st_size))
        continue
    if not (WINDOW[0] <= stamp <= WINDOW[1]):
        skipped.append((name, st.st_size, "구간 밖"))
        continue
    if now - st.st_mtime < MIN_AGE_SECONDS:
        skipped.append((name, st.st_size, "최근 파일"))
        continue
    truncated.append((name, st.st_size))

gib = lambda n: n / 1024 ** 3
print("완결 %d개 (%.1f GiB)" % (len(complete), gib(sum(s for _, s in complete))))
print("잘림·격리대상 %d개 (%.1f GiB)" % (len(truncated), gib(sum(s for _, s in truncated))))
for name, size, why in skipped:
    print("  보류: %s (%.2f GiB, %s)" % (name, gib(size), why))
if truncated:
    print("  범위: %s ~ %s" % (truncated[0][0], truncated[-1][0]))

if not apply:
    print("\n(dry-run — 실제 이름 변경은 --apply)")
    raise SystemExit(0)

moved = 0
for name, _ in truncated:
    src = os.path.join(DIR, name)
    dst = src + ".truncated"
    if os.path.exists(dst):
        print("  건너뜀(이미 존재): " + name)
        continue
    os.rename(src, dst)
    moved += 1
print("격리 완료: %d개" % moved)

rest = [n for n in sorted(os.listdir(DIR)) if NAME.match(n)]
bad = []
for name in rest:
    path = os.path.join(DIR, name)
    st = os.stat(path)
    with open(path, "rb") as fh:
        length = min(256, st.st_size)
        fh.seek(st.st_size - length)
        if not TAIL.search(fh.read(length).decode("utf8", "replace")):
            bad.append(name)
print("남은 .sql %d개 중 완결 표식 없는 것: %s" % (len(rest), bad or "없음"))
