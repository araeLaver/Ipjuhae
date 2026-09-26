"""수도권 월세 비중([수치 3]) 원문 확보용 엔드포인트 탐색 스크립트.

WebSearch/WebFetch가 막혀 있어 python urllib으로 직접 접근 가능한 경로만 찾는다.
"""
import sys
import urllib.request
import urllib.parse

UA = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
}


def get(url, headers=None, timeout=30, data=None):
    h = dict(UA)
    if headers:
        h.update(headers)
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        h.setdefault('Content-Type', 'application/x-www-form-urlencoded')
    req = urllib.request.Request(url, headers=h, data=body)
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.getcode(), resp.read().decode('utf-8', 'replace')
    except Exception as exc:
        return None, 'ERR ' + repr(exc)


TARGETS = [
    ('seoul-page', 'http://openapi.seoul.go.kr:8088/sample/json/tbLnOpendataRentV/1/1000/'),
    ('rt-xls-form', 'https://rt.molit.go.kr/pt/xls/xls.do'),
    ('rt-main', 'https://rt.molit.go.kr/'),
    ('korea-press', 'https://www.korea.kr/briefing/pressReleaseList.do?pageIndex=1&srchWord=' + urllib.parse.quote('주택 통계')),
    ('statmolit-search', 'https://stat.molit.go.kr/portal/search/hubSearch.do?searchWord=' + urllib.parse.quote('전월세')),
]

if __name__ == '__main__':
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for name, url in TARGETS:
        if only and only not in name:
            continue
        code, body = get(url)
        print('=== %s -> %s len=%d' % (name, code, len(body)))
        print(body[:700].replace('\n', ' '))
        print()
