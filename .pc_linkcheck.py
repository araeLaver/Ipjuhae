import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    ('R 한국부동산원 오피스텔가격동향조사',
     'https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1055&mi=10336&statId=S235920285'),
    ('T 부동산테크',
     'https://www.rtech.or.kr/portal/main/indexPage.do'),
]

for name, u in urls:
    try:
        req = urllib.request.Request(u, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9',
        })
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            body = resp.read(300000).decode('utf-8', 'replace')
            t = re.search(r'<title[^>]*>(.*?)</title>', body, re.S | re.I)
            print(name)
            print('  HTTP', resp.status, '| bytes', len(body))
            print('  final-url', resp.geturl()[:150])
            print('  title', (t.group(1).strip()[:150] if t else 'none'))
            for kw in ['오피스텔', '가격동향', '임대시장', '사이렌', '부동산테크', '한국부동산원']:
                if kw in body:
                    print('  kw-hit', kw)
    except Exception as e:
        print(name)
        print('  FAIL', type(e).__name__, str(e)[:250])
    print()
