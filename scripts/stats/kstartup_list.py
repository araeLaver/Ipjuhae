"""K-Startup 모집중 사업공고 목록을 마감일·분류와 함께 뽑는다.

사용: python3 kstartup_list.py [페이지수]
목록 화면은 서버 렌더링이라 인증키 없이 열린다.
"""
import re
import sys

import probe_url

BASE = ('https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do'
        '?schM=list&page=%d&pbancEndYn=N')
CATEGORIES = ('사업화', '기술개발(R&D)', '시설ㆍ공간ㆍ보육', '멘토링ㆍ컨설팅ㆍ교육',
              '행사ㆍ네트워크', '융자', '인력', '글로벌')
SPLIT = re.compile(r'(?=(?:%s)\s+D-\d+)' % '|'.join(re.escape(c) for c in CATEGORIES))
ROW = re.compile(r'(\S+)\s+D-(\d+)\s+마감일자\s+(\S+)\s+(.{0,120})')


def rows(page):
    _, _, html = probe_url.fetch(BASE % page)
    text = probe_url.strip_html(html)
    start = text.find('스크랩 닫기')
    for chunk in SPLIT.split(text[start:])[1:]:
        hit = ROW.match(chunk)
        if hit:
            yield hit.group(2), hit.group(3), hit.group(1), hit.group(4).strip()


if __name__ == '__main__':
    pages = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    for page in range(1, pages + 1):
        for days, due, cat, title in rows(page):
            print('D-%-3s %s | %-16s | %s' % (days, due, cat, title))
