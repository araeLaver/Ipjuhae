import json, importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

COMPANY = "0662097f-7363-4fc0-ac51-45798f6dddf0"
s, r = m.call("GET", "/api/companies/" + COMPANY + "/issues?q=DOW-1122")
hit = [i for i in r if i.get("identifier") == "DOW-1122"][0]
print(hit["identifier"], hit["status"], hit["priority"])
print(hit["description"][:900])
s, c = m.call("GET", "/api/issues/" + hit["id"] + "/comments")
print("\ncomments:", len(c))
for x in c[:2]:
    print("---", x["createdAt"], str(x["authorAgentId"])[:8])
    print(x["body"][:900])
