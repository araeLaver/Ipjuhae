import json, sys

p = sys.argv[1]
t = open(p, errors="replace").read()
lines = t.split("\n")
try:
    hdr = json.loads(lines[0])
    print("HDR:", hdr.get("app_name"), hdr.get("timestamp"), hdr.get("bug_type"))
except Exception as e:
    print("hdr parse", e)

body = t[len(lines[0]):]
try:
    b = json.loads(body)
except Exception as e:
    print("body parse fail", e)
    print(body[:2000])
    sys.exit(0)

print("exception:", json.dumps(b.get("exception"), ensure_ascii=False)[:400])
print("termination:", json.dumps(b.get("termination"), ensure_ascii=False)[:600])
asi = b.get("asi")
if asi:
    print("asi:", json.dumps(asi, ensure_ascii=False)[:2000])

# faulting thread backtrace
threads = b.get("threads") or []
imgs = b.get("usedImages") or []
ft = b.get("faultingThread")
idx = ft if isinstance(ft, int) else 0
if idx < len(threads):
    print("--- faulting thread", idx, "frames ---")
    for f in (threads[idx].get("frames") or [])[:25]:
        i = f.get("imageIndex")
        name = imgs[i].get("name") if isinstance(i, int) and i < len(imgs) else "?"
        print("  ", name, f.get("symbol") or "", f.get("imageOffset"))
