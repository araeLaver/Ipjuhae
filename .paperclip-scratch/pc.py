import os, json, urllib.request, urllib.error

API = os.environ["PAPERCLIP_API_URL"]
KEY = os.environ["PAPERCLIP_API_KEY"]
RUN = os.environ.get("PAPERCLIP_RUN_ID", "")
COMPANY = os.environ["PAPERCLIP_COMPANY_ID"]


def _req(path, method="GET", body=None):
    headers = {
        "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json",
        "X-Paperclip-Run-Id": RUN,
    }
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:800])
        raise


def get(path):
    return _req(path)


def post(path, body):
    return _req(path, "POST", body)


def patch(path, body):
    return _req(path, "PATCH", body)


def comment(issue_id, body_text):
    payload = dict()
    payload["body"] = body_text
    return post("/api/issues/" + issue_id + "/comments", payload)


def read(path):
    with open(path) as f:
        return f.read()
