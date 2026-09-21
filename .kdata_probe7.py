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


b, s = get("https://www.kdata.or.kr/kr/board/notice_01/boardView.do?bbsIdx=38957")
# isolate the article body area
m = re.search(r'(?:board_view|view_cont|bbs_view|cont_area|viewCont)[\s\S]{0,12000}', b)
seg = m.group(0) if m else b
txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>", " ", seg, flags=re.S))))
print(len(txt))
for k in re.findall(r".{0,100}(?:접수|모집|신청기간|마감|2026\.\s?\d{1,2}\.|첨부).{0,100}", txt)[:20]:
    print(" *", k.strip())
