"""korea.kr 보도자료 첨부파일을 내려받는다.

사용: python3 korea_kr_download.py <fileId> <저장경로>
"""
import sys
import urllib.request

UA = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Referer': 'https://www.korea.kr/',
}


def download(file_id, dest, tbl_key='GMN'):
    url = 'https://www.korea.kr/common/download.do?fileId=%s&tblKey=%s' % (file_id, tbl_key)
    req = urllib.request.Request(url, headers=UA)
    resp = urllib.request.urlopen(req, timeout=60)
    data = resp.read()
    with open(dest, 'wb') as fh:
        fh.write(data)
    return len(data), resp.headers.get('Content-Disposition')


if __name__ == '__main__':
    size, disp = download(sys.argv[1], sys.argv[2])
    print(size, disp)
