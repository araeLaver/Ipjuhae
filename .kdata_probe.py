import urllib.request, urllib.parse, ssl, re, html

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
        },
    )
    r = urllib.request.urlopen(req, timeout=25, context=ctx)
    return r.read().decode("utf-8", "ignore")


# bizinfo 공고 검색
for kw in ["문제해결은행", "데이터바우처"]:
    u = "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do?searchCondition=title&searchKeyword=" + urllib.parse.quote(kw)
    try:
        b = get(u)
        print("== bizinfo", kw, len(b))
        rows = re.findall(r'<a[^>]*title="[^"]*"[^>]*>(.*?)</a>', b, re.S)
        for t in rows:
            t = html.unescape(re.sub(r"<[^>]+>", "", t)).strip()
            if kw in t:
                print("  -", t[:120])
    except Exception as e:
        print("bizinfo", kw, "ERR", type(e).__name__, e)

# K-DATA 공지/사업공고 목록 후보 경로
for path in [
    "https://kdata.or.kr/datahub/portal/notice",
    "https://kdata.or.kr/datahub/portal/support",
    "https://www.kdata.or.kr/kr/board/notice_01/boardList.do",
]:
    try:
        b = get(path)
        txt = html.unescape(re.sub(r"<script.*?</script>", "", b, flags=re.S))
        txt = re.sub(r"<[^>]+>", " ", txt)
        txt = re.sub(r"\s+", " ", txt)
        print("==", path, len(b))
        for m in re.findall(r".{0,70}(?:모집|공고|접수).{0,70}", txt)[:12]:
            print("  -", m.strip()[:150])
    except Exception as e:
        print(path, "ERR", type(e).__name__, e)
