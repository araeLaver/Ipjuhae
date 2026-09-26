import os, json, sys, urllib.request, urllib.error

API = os.environ['PAPERCLIP_API_URL']
KEY = os.environ['PAPERCLIP_API_KEY']
RUN = os.environ.get('PAPERCLIP_RUN_ID', '')


def call(method, path, body=None):
    url = API + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + KEY)
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-Paperclip-Run-Id', RUN)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        return {'__error': e.code, 'body': e.read().decode()[:3000]}


if __name__ == '__main__':
    m = sys.argv[1]
    p = sys.argv[2]
    b = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None
    out = call(m, p, b)
    lim = int(os.environ.get('PC_LIMIT', '12000'))
    print(json.dumps(out, ensure_ascii=False, indent=1)[:lim])
