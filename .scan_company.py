import json, importlib.util, datetime

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

COMPANY = "0662097f-7363-4fc0-ac51-45798f6dddf0"

s, d = m.call("GET", "/api/companies/" + COMPANY + "/dashboard")
print("dashboard", s)
print(json.dumps(d, ensure_ascii=False)[:1200])

s, agents = m.call("GET", "/api/companies/" + COMPANY + "/agents")
names = {}
for a in agents:
    names[a["id"]] = a.get("name")

s, issues = m.call("GET", "/api/companies/" + COMPANY + "/issues?status=in_progress,todo&limit=300")
items = issues if isinstance(issues, list) else issues.get("items", [])
now = datetime.datetime(2026, 9, 21)
rows = []
for i in items:
    upd = i.get("updatedAt", "")[:10]
    try:
        age = (now - datetime.datetime.strptime(upd, "%Y-%m-%d")).days
    except Exception:
        age = -1
    rows.append((age, i["identifier"], i["status"], i["priority"],
                 names.get(i.get("assigneeAgentId"), i.get("assigneeUserId") or "(none)"),
                 i["title"][:46]))
rows.sort(reverse=True)
print("\nopen todo/in_progress:", len(rows))
for r in rows:
    print("%4dd | %-9s | %-11s | %-8s | %-8s | %s" % r)
