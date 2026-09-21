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
m = re.search(r"function\s+fnLinkView[\s\S]{0,800}", b)
print(m.group(0) if m else "fnLinkView def not found")
print("---- form fields ----")
for f in re.findall(r'<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"', b)[:20]:
    print(f)
print("---- form action ----")
for f in re.findall(r'<form[^>]*>', b)[:5]:
    print(f[:200])
