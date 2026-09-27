import hashlib, ssl, urllib.request

URL = 'https://www.k-startup.go.kr/afile/fileDownload/lfkLn'
LOCAL = 'docs/tmp/dow1258/notice.pdf'

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(URL, headers={
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=176938',
})
try:
    resp = urllib.request.urlopen(req, timeout=60, context=ctx)
    data = resp.read()
    print('status', resp.status, 'ctype', resp.headers.get('Content-Type'), 'bytes', len(data))
    print('remote sha256', hashlib.sha256(data).hexdigest())
    open('docs/tmp/dow1258/notice_remote.pdf', 'wb').write(data)
except Exception as exc:
    print('ERR', type(exc).__name__, exc)

local = open(LOCAL, 'rb').read()
print('local  sha256', hashlib.sha256(local).hexdigest(), 'bytes', len(local))
