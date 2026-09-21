import importlib.util, json, sys

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
pcapi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pcapi)

iid = sys.argv[1]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 2
chars = int(sys.argv[3]) if len(sys.argv) > 3 else 3000

s, d = pcapi.call("GET", "/api/issues/%s" % iid)
issue = d.get("issue", d) if isinstance(d, dict) else {}
print("###", issue.get("identifier"), issue.get("status"), "|", issue.get("title"))
print((issue.get("description") or "")[:2000])
print("\n=== COMMENTS ===")
s, d = pcapi.call("GET", "/api/issues/%s/comments" % iid)
items = d if isinstance(d, list) else d.get("items", [])
for c in items[-n:]:
    print("---", c["createdAt"][:16], c.get("authorAgentId"), c.get("authorUserId"))
    print(c["body"][:chars])
