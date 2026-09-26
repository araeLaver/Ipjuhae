"""정책브리핑(korea.kr) 보도자료에서 국토교통부 '주택 통계' 원문을 찾는다.

목적: [수치 3] 수도권 전월세 거래 중 월세 비중을 국토교통부 원문에서 확인.
사용: python3 scripts/stats/korea_kr_search.py "검색어" [페이지수] [시작일 YYYY-MM-DD] [종료일]
"""
import re
import sys
import urllib.parse
import urllib.request

UA = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9',
}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    except Exception as exc:
        return 'ERR ' + repr(exc)


def strip_tags(html):
    html = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', html)
    html = re.sub(r'(?s)<[^>]+>', ' ', html)
    for a, b in (('&nbsp;', ' '), ('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&quot;', '"'), ('&#39;', "'")):
        html = html.replace(a, b)
    return re.sub(r'[ \t]+', ' ', html)


def search_list(keyword, page=1, start=None, end=None):
    url = ('https://www.korea.kr/briefing/pressReleaseList.do?pageIndex=%d&srchWord=%s'
           % (page, urllib.parse.quote(keyword)))
    if start and end:
        url += '&startDate=%s&endDate=%s&period=direct' % (start, end)
    html = get(url)
    out = []
    # newsId 등장 위치 뒤 텍스트를 제목으로 사용
    for m in re.finditer(r'pressReleaseView\.do\?newsId=(\d+)', html):
        nid = m.group(1)
        tail = strip_tags(html[m.end():m.end() + 800])
        title = re.sub(r'\s+', ' ', tail).strip()
        out.append((nid, title[:160]))
    return out


def fetch_view(news_id):
    url = 'https://www.korea.kr/briefing/pressReleaseView.do?newsId=%s' % news_id
    return url, strip_tags(get(url))


if __name__ == '__main__':
    kw = sys.argv[1] if len(sys.argv) > 1 else '주택 통계'
    pages = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    start = sys.argv[3] if len(sys.argv) > 3 else None
    end = sys.argv[4] if len(sys.argv) > 4 else None
    seen = set()
    for p in range(1, pages + 1):
        rows = search_list(kw, p, start, end)
        if not rows:
            print('[page %d] 결과 없음' % p)
        for nid, title in rows:
            if nid in seen:
                continue
            seen.add(nid)
            print(nid, '|', title)
