import json, sys, glob, os

for p in sorted(glob.glob('/Users/down/Library/Logs/DiagnosticReports/node-2026-09-21-*.ips')):
    t = open(p, errors="replace").read()
    first = t.split("\n")[0]
    try:
        hdr = json.loads(first)
    except Exception:
        hdr = {}
    try:
        b = json.loads(t[len(first):])
    except Exception:
        b = {}
    print("==", os.path.basename(p))
    print("   pid:", b.get("pid"), "| procName:", b.get("procName"))
    print("   procPath:", (b.get("procPath") or "")[:110])
    print("   parentProc:", b.get("parentProc"), b.get("parentPid"))
    print("   captureTime:", b.get("captureTime"), "| procLaunch:", b.get("procLaunch"))
    print("   uptime-ish:", hdr.get("timestamp"))
