import urllib.request
import urllib.error

req = urllib.request.Request(
    'https://www.ipjuhae.com/',
    headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'},
)
with urllib.request.urlopen(req, timeout=25) as r:
    print('status', r.status)
    print('headers:')
    for kk, vv in r.headers.items():
        print('  ', kk, ':', vv)
    body = r.read().decode('utf-8', 'replace')

print('total len', len(body))
print('---- first 2500 ----')
print(body[:2500])
