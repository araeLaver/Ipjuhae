import json, os, urllib.request, urllib.parse

API = os.environ["PAPERCLIP_API_URL"].rstrip("/")
KEY = os.environ["PAPERCLIP_API_KEY"]
CO = os.environ["PAPERCLIP_COMPANY_ID"]


def get(path):
    req = urllib.request.Request(API + path, headers={"Authorization": "Bearer " + KEY})
    return json.load(urllib.request.urlopen(req, timeout=60))


d = get("/api/companies/" + CO + "/issues?q=" + urllib.parse.quote("DOW-448"))
items = d if isinstance(d, list) else d.get("items", [])
t = next((i for i in items if i.get("identifier") == "DOW-448"), None)
print(json.dumps({k: t.get(k) for k in ("id", "identifier", "status", "parentId", "goalId", "assigneeAgentId", "title")}, ensure_ascii=False, indent=1))
print((t.get("description") or "")[:1200])
c = get("/api/issues/" + t["id"] + "/comments")
print("--- comments:", len(c))
for x in c[-2:]:
    print(">>", x.get("createdAt"), (x.get("body") or "")[:600])
