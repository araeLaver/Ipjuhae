#!/usr/bin/env python3
"""K-Startup 공고의 첨부파일을 인증키 없이 내려받는다.

배경: 지원사업 공고 원문은 포털 화면이 아니라 첨부파일에 있다. K-Startup은
`/afile/fileDownload/{id}` 경로를 공개하고 있어 로그인·API키 없이 받을 수 있다
(Referer 헤더만 필요). 접수용 구글폼은 별개로 로그인 게이트(HTTP 401)이므로
폼 안에만 있는 자료는 이 경로로 얻을 수 없다 — DOW-1153에서 확인.

사용:
    python3 scripts/stats/kstartup_attachments.py 179280 [출력디렉터리]

출력: 첨부 링크·원본 파일명 목록을 찍고, 지정 디렉터리에 파일을 저장한다.
"""
import os
import re
import sys
import urllib.error
import urllib.request

VIEW = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn={}"
BASE = "https://www.k-startup.go.kr"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
)


def fetch(url, referer=None, timeout=60):
    headers = {"User-Agent": UA}
    if referer:
        headers["Referer"] = referer
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout)


def sniff_ext(data):
    if data[:4] == b"%PDF":
        return ".pdf"
    if data[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return ".hwp"  # 구 한글/OLE 복합문서
    if data[:2] == b"PK":
        return ".zip"  # hwpx·docx·xlsx 포함
    return ".bin"


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    pbanc = sys.argv[1]
    outdir = sys.argv[2] if len(sys.argv) > 2 else "docs/tmp/kstartup_" + pbanc
    view = VIEW.format(pbanc)

    html = fetch(view).read().decode("utf-8", "replace")
    links = sorted(set(re.findall(r"/afile/fileDownload/[A-Za-z0-9_\-]+", html)))
    if not links:
        print("첨부 없음. 공고가 본문만으로 구성되었거나 경로 형식이 바뀌었다.")
        return 1

    os.makedirs(outdir, exist_ok=True)
    for link in links:
        # 링크 앞쪽 마크업에 원본 파일명이 title 속성으로 붙어 있다.
        i = html.find(link)
        near = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html[max(0, i - 400):i + 200]))
        m = re.search(r"\[첨부파일\]\s*(.+?\.(?:pdf|hwp|hwpx|zip|docx|xlsx))", near, re.I)
        label = m.group(1).strip() if m else "(파일명 미확인)"

        try:
            resp = fetch(BASE + link, referer=view)
            data = resp.read()
        except urllib.error.HTTPError as exc:
            print("실패", link, "HTTP", exc.code)
            continue

        path = os.path.join(outdir, link.rsplit("/", 1)[-1] + sniff_ext(data))
        with open(path, "wb") as handle:
            handle.write(data)
        print("받음 {} ({:,} bytes) -> {}  | {}".format(link, len(data), path, label))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
