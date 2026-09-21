import json, importlib.util
spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
s, r = m.call("GET", "/api/companies/0662097f-7363-4fc0-ac51-45798f6dddf0/agents")
for a in r:
    print(a["id"][:8], "|", a.get("nameKey") or a.get("urlKey"), "|", a.get("name"), "|", a.get("role"), "|", a.get("status"))
