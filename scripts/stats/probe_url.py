"""URL 접근 가능 여부와 본문 일부를 확인한다.

사용: python3 probe_url.py <url> [검색어 ...]
WebFetch/WebSearch가 막힌 환경에서 공개 페이지를 직접 확인하기 위한 최소 도구다.
검색어를 주면 본문에서 그 주변만 뽑아 보여 준다.
"""
import gzip
import re
import ssl
import sys
import urllib.error
import urllib.request

UA = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'ko-KR,ko;q=0.9',
}


def strip_html(html):
    html = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', html)
    text = re.sub(r'(?s)<[^>]+>', ' ', html)
    return re.sub(r'\s+', ' ', text).strip()


def fetch(url, insecure=False):
    ctx = ssl._create_unverified_context() if insecure else None
    req = urllib.request.Request(url, headers=UA)
    resp = urllib.request.urlopen(req, timeout=40, context=ctx)
    raw = resp.read()
    if resp.headers.get('Content-Encoding') == 'gzip':
        raw = gzip.decompress(raw)
    charset = resp.headers.get_content_charset() or 'utf-8'
    return resp.getcode(), resp.geturl(), raw.decode(charset, 'replace')


if __name__ == '__main__':
    url = sys.argv[1]
    terms = sys.argv[2:]
    try:
        code, final, html = fetch(url)
    except urllib.error.HTTPError as exc:
        print('HTTP', exc.code, exc.reason)
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 - 접근 불가 사유를 그대로 기록한다
        try:
            code, final, html = fetch(url, insecure=True)
            print('(TLS 검증 생략)')
        except Exception as exc2:  # noqa: BLE001
            print('FAIL', type(exc).__name__, exc, '/', type(exc2).__name__, exc2)
            sys.exit(1)
    text = strip_html(html)
    print(code, final, len(text), '자')
    if not terms:
        print(text[:2500])
    for term in terms:
        hits = [m.start() for m in re.finditer(re.escape(term), text)]
        print('\n== %s: %d건 ==' % (term, len(hits)))
        for pos in hits[:6]:
            print('...', text[max(0, pos - 150):pos + 250], '...')
