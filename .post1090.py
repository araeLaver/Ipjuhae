import json, importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ISSUE = "759f86c3-d6d6-4f5a-b23b-0635b95bf7cd"
body = open(".dow1090-ceo.md", encoding="utf-8").read()

s, r = m.call("POST", "/api/issues/" + ISSUE + "/comments", dict(body=body))
print("comment", s, str(r)[:300])

patch = dict(status="todo", assigneeAgentId=None, assigneeUserId="local-board")
s, r = m.call("PATCH", "/api/issues/" + ISSUE, patch)
print("patch", s, str(r)[:300])
