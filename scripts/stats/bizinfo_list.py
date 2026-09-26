"""기업마당(bizinfo.go.kr) 지원사업 공고 목록을 페이지 단위로 훑는다.

사용: python3 bizinfo_list.py [페이지수] [키워드 ...]
키워드를 주면 제목에 그 말이 든 행만 출력한다.
검색어 파라미터(keyword=)는 500을 돌려주므로 목록을 받아 로컬에서 거른다.
"""
import re
import sys
import urllib.parse

import probe_url

BASE = 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?'
ROW = re.compile(
    r'(\d{3,5})\s+(금융|기술|인력|수출|내수|창업|경영|기타)\s+(.+?)\s+'
    r'(\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}|예산 소진시까지|상시)\s+(.+?)\s+\d{4}-\d{2}-\d{2}\s+\d+'
)


def rows(page):
    query = urllib.parse.urlencode({'rows': 15, 'cpage': page})
    _, _, html = probe_url.fetch(BASE + query)
    text = probe_url.strip_html(html)
    start = text.find('조회수의 정보')
    return ROW.findall(text[start:])


if __name__ == '__main__':
    pages = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    terms = sys.argv[2:]
    for page in range(1, pages + 1):
        for num, field, title, period, org in rows(page):
            if terms and not any(t in title for t in terms):
                continue
            print('%s | %-4s | %-28s | %s' % (num, field, period, title[:90]))
