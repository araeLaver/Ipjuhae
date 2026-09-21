import urllib.request, ssl, re, html

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request(
    "https://www.kdata.or.kr/kr/board/notice_01/boardView.do?bbsIdx=38957",
    headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.kdata.or.kr/kr/board/notice_01/boardList.do"},
)
b = urllib.request.urlopen(req, timeout=25, context=ctx).read().decode("utf-8", "ignore")
m = re.search(r"(?:board_view|view_cont|bbs_view|cont_area|viewCont)[\s\S]{0,12000}", b)
seg = m.group(0) if m else b
txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>", " ", seg, flags=re.S))))
print(txt)
