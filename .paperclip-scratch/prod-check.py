import json
import urllib.request
import urllib.error

BASE = 'https://www.ipjuhae.com'

def check(path, expect_json=False):
    url = BASE + path
    req = urllib.request.Request(url, headers={'User-Agent': 'ipjuhae-cto-check/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read(4000).decode('utf-8', 'replace')
            print(path, '->', r.status)
            if expect_json:
                try:
                    print('  ', json.dumps(json.loads(body), ensure_ascii=False)[:900])
                except Exception:
                    print('  (non-json)', body[:300])
            else:
                print('   len=', len(body))
            return r.status, body
    except urllib.error.HTTPError as e:
        body = e.read(4000).decode('utf-8', 'replace')
        print(path, '-> HTTP', e.code)
        if expect_json:
            try:
                print('  ', json.dumps(json.loads(body), ensure_ascii=False)[:900])
            except Exception:
                print('  (non-json)', body[:300])
        return e.code, body
    except Exception as e:
        print(path, '-> ERROR', type(e).__name__, e)
        return None, ''


check('/api/health', expect_json=True)
status, body = check('/')
if body:
    for needle in ['커뮤니티', '로그인', '회원가입', '입주해']:
        print('   contains', needle, ':', needle in body)
check('/home')
