"""DOW-362 — 운영 URL 대상 공개 표면 smoke. 인증이 필요한 경로는 보호 동작만 본다.

읽기 전용이다. 쓰기 요청은 의도적으로 유효하지 않은 입력만 보내 validation 경로를
확인하며, 실제 발송/생성이 일어나지 않는지 응답으로 확인한다.
"""

import json
import urllib.error
import urllib.request

BASE = "https://www.ipjuhae.com"
rows = []


def hit(name, path, method="GET", body=None, headers=None, expect=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("content-type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            st, txt = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        st, txt = e.code, e.read().decode()
    except Exception as e:  # noqa: BLE001
        rows.append((name, "NETERR", str(e)[:120], "?"))
        return
    try:
        snippet = json.dumps(json.loads(txt), ensure_ascii=False)[:200]
    except Exception:  # noqa: BLE001
        snippet = "raw:" + txt[:160].replace("\n", " ")
    verdict = "-" if expect is None else ("PASS" if st in expect else "FAIL")
    rows.append((name, st, snippet, verdict))


# 1) 기본 readiness
hit("health", "/api/health", expect=[200])
# 운영에서는 LAUNCH_SMOKE_TOKEN 미설정/미제공 시 403이어야 한다(보호 자체가 체크 항목).
hit("launch/smoke (no token)", "/api/launch/smoke", expect=[401, 403])

# 2) 공개 카탈로그
hit("listings (public)", "/api/listings", expect=[200])
hit("properties (public)", "/api/properties", expect=[200])
hit("community posts (public)", "/api/community/posts", expect=[200])

# 3) auth validation — 유효하지 않은 입력만 보낸다
hit("login validation", "/api/auth/login", "POST", {"email": "not-an-email", "password": ""},
    {"origin": BASE}, expect=[400, 401, 422])
hit("signup validation", "/api/auth/signup", "POST", {"email": "not-an-email", "password": "x"},
    {"origin": BASE}, expect=[400, 422])

# 4) 인증 보호 — 토큰 없이 접근 시 차단되어야 한다
hit("admin stats", "/api/admin/stats", expect=[401, 403])
hit("account me", "/api/auth/me", expect=[401])
hit("account delete", "/api/account/delete", "DELETE", None, {"origin": BASE}, expect=[401, 403, 405])

# 5) trust platform 표면 — 인증 보호만 확인(happy path는 계정 필요)
hit("access logs", "/api/trust/access-logs", expect=[401, 403, 404])
hit("references", "/api/references", expect=[401, 403, 404])
hit("reference disputes", "/api/references/disputes", expect=[401, 403, 404])
hit("trust report", "/api/trust/report", expect=[401, 403, 404])
hit("public profile consent", "/api/profile/public-consent", expect=[401, 403, 404])

# 6) cron 보호
hit("cron (no secret)", "/api/cron/trust-outbox", expect=[401, 403, 404])

print("%-28s %-6s %-6s %s" % ("check", "status", "verdict", "body"))
for name, st, snippet, verdict in rows:
    print("%-28s %-6s %-6s %s" % (name, st, verdict, snippet))

fails = [r for r in rows if r[3] == "FAIL" or r[1] == "NETERR"]
print("\n%d checks, %d fail" % (len(rows), len(fails)))
for f in fails:
    print("  FAIL", f[0], f[1], f[2])
