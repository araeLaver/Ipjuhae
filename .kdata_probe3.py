import urllib.request, urllib.parse, ssl, re, html

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    r = urllib.request.urlopen(req, timeout=25, context=ctx)
    return r.read().decode("utf-8", "ignore"), r.status


b, s = get("https://www.kdata.or.kr/kr/board/notice_01/boardList.do?pageIndex=2")
idx = b.find("문제해결은행")
while idx != -1:
    seg = b[max(0, idx - 1500): idx + 200]
    for m in set(re.findall(r"(?:fn_\w+|onclick=\"[^\"]*)\(?['\"]?(\d{3,7})['\"]?\)?", seg)):
        pass
    ons = re.findall(r"onclick=\"([^\"]+)\"", seg)
    if ons:
        print("ONCLICK near:", ons[-3:])
        break
    idx = b.find("문제해결은행", idx + 1)

# fallback: dump all numeric ids on the page with surrounding title
for m in re.finditer(r"boardSeq['\"]?\s*[:=]\s*['\"]?(\d+)", b):
    print("boardSeq", m.group(1))

for m in re.finditer(r"(fn_\w*[Vv]iew\w*)\s*\(([^)]*)\)", b):
    print("fn:", m.group(1), m.group(2)[:60])
