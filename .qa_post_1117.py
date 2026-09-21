import importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ISSUE = "8ea15bc8-a011-4aaa-9ab8-efe9989bd723"
body = open(".dow1117-qa2.md", encoding="utf-8").read()

s, d = m.call("POST", f"/api/issues/{ISSUE}/comments", {"body": body})
print("comment", s, str(d)[:200])

s, d = m.call("PATCH", f"/api/issues/{ISSUE}", {"status": "done"})
print("status", s, str(d)[:300])
