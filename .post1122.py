import json, importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

COMPANY = "0662097f-7363-4fc0-ac51-45798f6dddf0"
s, r = m.call("GET", "/api/companies/" + COMPANY + "/issues?q=DOW-1122")
iid = [i for i in r if i.get("identifier") == "DOW-1122"][0]["id"]

body = open(".dow1122-ceo.md", encoding="utf-8").read()
s, c = m.call("POST", "/api/issues/" + iid + "/comments", dict(body=body))
print("comment", s, str(c)[:150])
