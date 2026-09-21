import json, os, sys, urllib.request, urllib.error

API = os.environ["PAPERCLIP_API_URL"]
KEY = os.environ["PAPERCLIP_API_KEY"]
RUN = os.environ.get("PAPERCLIP_RUN_ID", "")


def call(method, path, body=None):
    url = API + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + KEY)
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Paperclip-Run-Id", RUN)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


if __name__ == "__main__":
    m, p = sys.argv[1], sys.argv[2]
    b = None
    if len(sys.argv) > 3:
        arg = sys.argv[3]
        if arg.startswith("@"):
            b = json.loads(open(arg[1:], encoding="utf-8").read())
        else:
            b = json.loads(arg)
    s, r = call(m, p, b)
    print(s)
    print(json.dumps(r, ensure_ascii=False, indent=1) if isinstance(r, (dict, list)) else r)
