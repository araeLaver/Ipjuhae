import json, os, sys, urllib.error, urllib.request

B = os.environ["PAPERCLIP_API_URL"]
K = os.environ["PAPERCLIP_API_KEY"]
RUN = os.environ.get("PAPERCLIP_RUN_ID", "")

payload = {
    "agentId": os.environ["PAPERCLIP_AGENT_ID"],
    "expectedStatuses": ["todo", "backlog", "blocked"],
}
req = urllib.request.Request(
    B + "/api/issues/" + sys.argv[1] + "/checkout",
    data=json.dumps(payload).encode(),
    method="POST",
    headers={
        "Authorization": "Bearer " + K,
        "Content-Type": "application/json",
        "X-Paperclip-Run-Id": RUN,
    },
)
try:
    res = json.load(urllib.request.urlopen(req))
    print("checked out", res.get("identifier"), res.get("status"))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:400])
