"""DOW-1168 로그인 복귀 경로 운영 실물 점검 스크립트.

배포된 운영 서버(https://www.ipjuhae.com)를 상대로 다음을 확인한다.

1. 소셜 로그인 시작 라우트가 `redirect` 값을 `oauth_redirect` 쿠키로 왕복시키는가
2. 외부 주소(`//host`, `https://host`)·제어문자가 섞인 값을 거부하는가
3. 보호 페이지 미로그인 접근이 `/login?redirect=...`로 가는가 (중복 슬래시 없음)
4. 응답 어디에도 `//` 형태의 중복 슬래시 경로가 생기지 않는가

사용: python3 scripts/qa/dow1168_login_return_probe.py [base-url]
"""

import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://www.ipjuhae.com'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """리다이렉트를 따라가지 않아야 Location/Set-Cookie를 그대로 볼 수 있다."""

    def redirect_request(self, *args, **kwargs):
        return None


opener = urllib.request.build_opener(NoRedirect)


def probe(path, cookie=None):
    headers = {'User-Agent': 'ipjuhae-qa/1.0'}
    if cookie:
        headers['Cookie'] = cookie
    request = urllib.request.Request(BASE + path, headers=headers)
    try:
        response = opener.open(request, timeout=25)
        return response.status, list(response.getheaders()), response.read(20000).decode('utf-8', 'replace')
    except urllib.error.HTTPError as error:
        return error.code, list(error.headers.items()), error.read(20000).decode('utf-8', 'replace')


def report(path, cookie=None, show_body=0):
    status, headers, body = probe(path, cookie)
    cookies = [v for k, v in headers if k.lower() == 'set-cookie']
    location = next((v for k, v in headers if k.lower() == 'location'), '')
    print('==', path)
    print('   status:', status, '| location:', location[:120])
    print('   set-cookie:', ' || '.join(c[:120] for c in cookies) if cookies else '(none)')
    if show_body:
        print('   body:', body[:show_body].replace('\n', ' '))
    return status, location, cookies, body


SOCIAL_CASES = [
    '/api/auth/social/kakao?redirect=%2Fcommunity%2Fabc123',
    '/api/auth/social/kakao?redirect=%2F%2Fevil.example.com',
    '/api/auth/social/kakao?redirect=https%3A%2F%2Fevil.example.com',
    '/api/auth/social/kakao?redirect=%2Fcommunity%2Fabc%0A%0Dx',
    '/api/auth/social/kakao',
]

PROTECTED_CASES = [
    '/profile',
    '/landlord',
    '/community/write',
    '/messages',
]

if __name__ == '__main__':
    print('# 소셜 로그인 시작 — oauth_redirect 쿠키 왕복/거부')
    for case in SOCIAL_CASES:
        report(case, show_body=160)

    print()
    print('# 보호 페이지 미로그인 접근 — /login?redirect= 형태')
    for case in PROTECTED_CASES:
        report(case)

    print()
    print('# 매직 링크 콜백 — 외부 주소 거부')
    report('/auth/callback?redirect=https%3A%2F%2Fevil.example.com')
    report('/auth/callback?redirect=%2F%2Fevil.example.com')
