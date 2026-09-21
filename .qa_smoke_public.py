import json, urllib.request, urllib.error

BASE = "https://www.ipjuhae.com"


def hit(name, path, method="GET", body=None, headers=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("content-type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            st, txt = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        st, txt = e.code, e.read().decode()
    except Exception as e:
        print("%-24s NETERR %s" % (name, e))
        return
    try:
        j = json.loads(txt)
    except Exception:
        j = "raw:" + txt[:200]
    print("%-24s status=%s body=%s" % (name, st, json.dumps(j, ensure_ascii=False)[:280]))


hit("launch-smoke-route", "/api/launch/smoke")
hit("health", "/api/health")
hit("listings-public", "/api/listings")
hit("phone-validation", "/api/auth/phone/send", "POST", {"phoneNumber": "invalid"}, {"origin": BASE})
hit("admin-route-protection", "/api/admin/stats")
