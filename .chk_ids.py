import json, importlib.util
spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
for n in ["DOW-447","DOW-637","DOW-1084","DOW-909","DOW-780","DOW-1069"]:
    s, r = m.call("GET", "/api/companies/0662097f-7363-4fc0-ac51-45798f6dddf0/issues?q=" + n)
    items = r if isinstance(r, list) else r.get("items", [])
    hit = [i for i in items if i.get("identifier") == n]
    for i in hit[:1]:
        print(i["identifier"], "|", i["status"], "| agent=", str(i["assigneeAgentId"])[:8], "| user=", i["assigneeUserId"], "|", i["title"][:50])
    if not hit:
        print(n, "NOT FOUND in", len(items), "results")
