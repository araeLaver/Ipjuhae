"""DOW-1171 QA: 백업 디렉터리 완결 표식 독립 검증."""
import os
import re
import glob

DIR = "/Volumes/WorkDrive/Develop/_runtime/paperclip-home/instances/default/data/backups"
TAIL = re.compile(
    r"\nCOMMIT;\n(?:--> statement-breakpoint|-- paperclip statement breakpoint [0-9a-f-]{36})\s*$"
)
NAME = re.compile(r"^paperclip-\d{8}-\d{6}\.sql$")


def has_marker(path: str) -> bool:
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            f.seek(max(0, size - 256))
            return bool(TAIL.search(f.read().decode("utf8", "replace")))
    except Exception:
        return False


sql = sorted(glob.glob(f"{DIR}/*.sql"))
part = sorted(glob.glob(f"{DIR}/*.part"))
trunc = sorted(glob.glob(f"{DIR}/*.truncated"))

print(f".sql        = {len(sql)}")
print(f".part       = {len(part)}")
print(f".truncated  = {len(trunc)}")

bad = [p for p in sql if not has_marker(p)]
odd_name = [p for p in sql if not NAME.match(os.path.basename(p))]
print(f"\n표식 없는 .sql = {len(bad)}")
for p in bad[:10]:
    print("  ", os.path.basename(p), os.path.getsize(p))
print(f"이름 규칙 벗어난 .sql = {len(odd_name)}")
for p in odd_name[:10]:
    print("  ", os.path.basename(p))

if sql:
    sizes = sorted(os.path.getsize(p) for p in sql)
    gib = sum(sizes) / 1024**3
    print(f"\n.sql 총량 {gib:.2f} GiB, 중앙값 {sizes[len(sizes)//2]/1024**2:.1f} MiB, 최대 {sizes[-1]/1024**2:.1f} MiB")
    newest = max(sql, key=os.path.getmtime)
    import datetime
    print("가장 최근 .sql:", os.path.basename(newest),
          datetime.datetime.fromtimestamp(os.path.getmtime(newest)).isoformat(timespec="seconds"))
if trunc:
    tg = sum(os.path.getsize(p) for p in trunc) / 1024**3
    print(f".truncated 총량 {tg:.2f} GiB")
    # .truncated 중 실제로는 완결 표식을 가진 것이 있는지(격리 오판) 확인
    wrongly = [p for p in trunc if has_marker(p)]
    print(f"완결 표식을 가진 .truncated(격리 오판 가능) = {len(wrongly)}")
    for p in wrongly[:5]:
        print("  ", os.path.basename(p))

free = os.statvfs(DIR)
print(f"\n볼륨 여유 공간 {free.f_bavail * free.f_frsize / 1024**3:.1f} GiB")
