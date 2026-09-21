import importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
pc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pc)

st, r = pc.call("GET", "/api/issues/DOW-1134")
ISSUE = r["id"]

body = open(".dow1134-decision.md", encoding="utf-8").read()
print(pc.call("POST", "/api/issues/" + ISSUE + "/comments", {"body": body})[0])
print(pc.call("PATCH", "/api/issues/" + ISSUE, {"priority": "critical"})[0])
