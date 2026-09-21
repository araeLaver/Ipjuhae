import json, importlib.util
spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
s, r = m.call("GET", "/api/companies/0662097f-7363-4fc0-ac51-45798f6dddf0/issues?q=DOW-780")
iid = [i for i in r if i.get("identifier")=="DOW-780"][0]["id"]
s, c = m.call("GET", "/api/issues/%s/comments" % iid)
print("comments:", len(c))
for x in c[:2]:
    print("---", x["createdAt"], "agent", str(x["authorAgentId"])[:8])
    print(x["body"][:1500])
