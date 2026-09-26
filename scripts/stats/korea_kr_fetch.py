"""korea.kr 보도자료 본문/첨부파일 링크를 뽑는다."""
import re
import sys
import urllib.request

from korea_kr_search import UA, get, strip_tags


def view(news_id):
    url = 'https://www.korea.kr/briefing/pressReleaseView.do?newsId=%s' % news_id
    html = get(url)
    files = re.findall(r'href="([^"]*(?:fileDown|FileDown|download)[^"]*)"', html)
    files += re.findall(r"(?:location\.href|fn_egov_downFile)\(['\"]([^'\"]+)['\"]", html)
    text = re.sub(r'\s+', ' ', strip_tags(html))
    return url, files, text


if __name__ == '__main__':
    nid = sys.argv[1]
    url, files, text = view(nid)
    print('URL:', url)
    print('--- 첨부 후보 ---')
    for f in sorted(set(files)):
        print(f)
    print('--- 본문 ---')
    print(text[:4000])
