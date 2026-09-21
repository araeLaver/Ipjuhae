import urllib.request, urllib.parse, ssl, re, html

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    r = urllib.request.urlopen(req, timeout=25, context=ctx)
    return r.read().decode("utf-8", "ignore"), r.status


def titles(b):
    txt = re.sub(r"<script.*?</script>", " ", b, flags=re.S)
    out = []
    for m in re.findall(r"제목\s*(.{0,90}?)\s*(?:첨부파일|조회수)", html.unescape(re.sub(r"<[^>]+>", " ", txt))):
        out.append(re.sub(r"\s+", " ", m).strip())
    return out


# 1) K-DATA 공지 게시판 키워드 검색
for kw in ["문제해결은행", "맞춤지원"]:
    u = ("https://www.kdata.or.kr/kr/board/notice_01/boardList.do?searchType=title&searchWord="
         + urllib.parse.quote(kw))
    try:
        b, s = get(u)
        ts = titles(b)
        print("== notice search", kw, s, len(ts))
        for t in ts[:15]:
            print("  -", t)
    except Exception as e:
        print("notice", kw, "ERR", type(e).__name__, e)

# 2) 공지 1~2페이지 제목 전량
for p in (1, 2):
    u = "https://www.kdata.or.kr/kr/board/notice_01/boardList.do?pageIndex=%d" % p
    try:
        b, s = get(u)
        ts = titles(b)
        print("== notice page", p, s, len(ts))
        for t in ts:
            print("  -", t)
    except Exception as e:
        print("page", p, "ERR", type(e).__name__, e)
