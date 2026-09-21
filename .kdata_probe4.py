import urllib.request, ssl, re, html

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def get(u, data=None):
    req = urllib.request.Request(
        u,
        data=data.encode() if data else None,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": "https://www.kdata.or.kr/kr/board/notice_01/boardList.do",
        },
    )
    r = urllib.request.urlopen(req, timeout=25, context=ctx)
    return r.read().decode("utf-8", "ignore"), r.status


b, _ = get("https://www.kdata.or.kr/kr/board/notice_01/boardList.do?pageIndex=2")
# map seq -> title
pairs = re.findall(r"fnLinkView\('(\d+)'\);\"[^>]*>(.*?)</a>", b, re.S)
targets = []
for seq, t in pairs:
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).strip()
    if "문제해결은행" in t:
        targets.append((seq, t))
print(targets)

for seq, t in targets:
    for u in [
        "https://www.kdata.or.kr/kr/board/notice_01/boardView.do?bbsIdx=" + seq,
        "https://www.kdata.or.kr/kr/board/notice_01/boardView.do?seq=" + seq,
        "https://www.kdata.or.kr/kr/board/notice_01/boardView.do?idx=" + seq,
    ]:
        try:
            db, ds = get(u)
            txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>", " ", db, flags=re.S))))
            if t[:12] in txt:
                print("OK", u, ds, len(db))
                for k in re.findall(r".{0,90}(?:접수기간|모집기간|신청기간|마감|18:00|까지).{0,90}", txt)[:8]:
                    print("   *", k.strip())
                break
            else:
                print("miss", u, ds)
        except Exception as e:
            print("ERR", u, type(e).__name__, e)
