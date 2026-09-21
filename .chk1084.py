import json, importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

s, r = m.call("GET", "/api/issues/53ead004-8fea-41cd-88cf-4584da08d07d/comments")
print("total", len(r))
for x in r[:3]:
    print("---", x["createdAt"], "agent=", str(x["authorAgentId"])[:8], "user=", x["authorUserId"])
    print(x["body"][:400])
