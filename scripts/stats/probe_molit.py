import urllib.request

H = {
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://rt.molit.go.kr/',
    'User-Agent': 'Mozilla/5.0',
}


def get(url, headers=H):
    req = urllib.request.Request(url, headers=headers)
    try:
        return urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'replace')
    except Exception as exc:
        return 'ERR ' + str(exc)


if __name__ == '__main__':
    print('--- chart.do 2025 ---')
    print(get('https://rt.molit.go.kr/pt/main/chart.do?chartYear=2025')[:800])
