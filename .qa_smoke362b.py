"""DOW-362 2차 — 1차에서 404(경로 오타)였던 trust 표면을 실제 라우트로 다시 본다."""

import json
import urllib.error
import urllib.request

BASE = "https://www.ipjuhae.com"
rows = []


def hit(name, path, method="GET", expect=None):
    req = urllib.request.Request(BASE + path, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            st, txt = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        st, txt = e.code, e.read().decode()
    except Exception as e:  # noqa: BLE001
        rows.append((name, "NETERR", str(e)[:120], "?"))
        return
    try:
        snippet = json.dumps(json.loads(txt), ensure_ascii=False)[:160]
    except Exception:  # noqa: BLE001
        snippet = "html/raw:" + txt[:80].replace("\n", " ")
    rows.append((name, st, snippet, "PASS" if expect and st in expect else "FAIL"))


hit("access-logs", "/api/access-logs", expect=[401, 403])
hit("consent events", "/api/consent/events", expect=[401, 403])
hit("rental-risk brief", "/api/rental-risk/brief", expect=[401, 403])
hit("references verify", "/api/references/verify", expect=[401, 403, 405])

print("%-22s %-6s %-6s %s" % ("check", "status", "verdict", "body"))
for name, st, snippet, verdict in rows:
    print("%-22s %-6s %-6s %s" % (name, st, verdict, snippet))
print("\n%d checks, %d fail" % (len(rows), len([r for r in rows if r[3] != "PASS"])))
