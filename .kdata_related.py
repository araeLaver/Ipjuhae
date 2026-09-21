import json, os, urllib.request, urllib.parse

API = os.environ["PAPERCLIP_API_URL"].rstrip("/")
KEY = os.environ["PAPERCLIP_API_KEY"]
CO = os.environ["PAPERCLIP_COMPANY_ID"]


def get(path):
    req = urllib.request.Request(API + path, headers={"Authorization": "Bearer " + KEY})
    return json.load(urllib.request.urlopen(req, timeout=60))


for q in ["K-DATA", "문제해결은행"]:
    d = get("/api/companies/" + CO + "/issues?q=" + urllib.parse.quote(q))
    items = d if isinstance(d, list) else d.get("items", [])
    print("==", q, len(items))
    for i in items:
        if i.get("status") in ("done", "cancelled"):
            continue
        print(
            i.get("identifier"),
            "|",
            i.get("status"),
            "|",
            (i.get("assigneeAgentId") or "")[:8],
            "|",
            (i.get("title") or "")[:70],
        )
