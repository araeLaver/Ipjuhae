import urllib.request, ssl, re, html

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def get(u):
    req = urllib.request.Request(
        u,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.kdata.or.kr/kr/board/notice_01/boardList.do",
        },
    )
    r = urllib.request.urlopen(req, timeout=25, context=ctx)
    return r.read().decode("utf-8", "ignore"), r.status


for seq in ("38957", "38959"):
    u = "https://www.kdata.or.kr/kr/board/notice_01/boardView.do?bbsIdx=" + seq
    b, s = get(u)
    txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>", " ", b, flags=re.S))))
    print("==", seq, s, len(b), "| 문제해결은행 in page:", "문제해결은행" in txt)
    i = txt.find("문제해결은행")
    if i != -1:
        print("   ctx:", txt[max(0, i - 200): i + 600])
