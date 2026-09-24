import json, os, sys, urllib.request

B = os.environ["PAPERCLIP_API_URL"]
K = os.environ["PAPERCLIP_API_KEY"]
RUN = os.environ.get("PAPERCLIP_RUN_ID", "")

issue_id = sys.argv[1]
body = open(sys.argv[2]).read()

req = urllib.request.Request(
    B + "/api/issues/" + issue_id + "/comments",
    data=json.dumps({"body": body}).encode(),
    method="POST",
    headers={
        "Authorization": "Bearer " + K,
        "Content-Type": "application/json",
        "X-Paperclip-Run-Id": RUN,
    },
)
res = json.load(urllib.request.urlopen(req))
print("posted", res.get("id"))
