import json, os, urllib.request, urllib.error, sys

API = os.environ["PAPERCLIP_API_URL"]
KEY = os.environ["PAPERCLIP_API_KEY"]
RUN = os.environ.get("PAPERCLIP_RUN_ID", "")
ISSUE = "5a2eb99f-35b9-40de-b655-e38a9ce0dabe"

body = open(sys.argv[1], encoding="utf-8").read()
req = urllib.request.Request(API + "/api/issues/%s/comments" % ISSUE,
                             data=json.dumps({"body": body}).encode(), method="POST")
req.add_header("Authorization", "Bearer " + KEY)
req.add_header("Content-Type", "application/json")
req.add_header("X-Paperclip-Run-Id", RUN)
try:
    with urllib.request.urlopen(req) as r:
        print(r.status, json.loads(r.read().decode()).get("id"))
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:1000])
