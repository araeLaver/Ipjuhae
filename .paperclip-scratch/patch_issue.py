import json, os, sys, urllib.error, urllib.request

B = os.environ["PAPERCLIP_API_URL"]
K = os.environ["PAPERCLIP_API_KEY"]
RUN = os.environ.get("PAPERCLIP_RUN_ID", "")

issue_id = sys.argv[1]
status = sys.argv[2]
comment_path = sys.argv[3] if len(sys.argv) > 3 else None

payload = {"status": status}
if comment_path:
    payload["comment"] = open(comment_path).read()

req = urllib.request.Request(
    B + "/api/issues/" + issue_id,
    data=json.dumps(payload).encode(),
    method="PATCH",
    headers={
        "Authorization": "Bearer " + K,
        "Content-Type": "application/json",
        "X-Paperclip-Run-Id": RUN,
    },
)
try:
    res = json.load(urllib.request.urlopen(req))
    print("patched", res.get("identifier"), res.get("status"))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:400])
