#!/usr/bin/env python3
"""DOW-1224/DOW-1254 — 앱 경로(`x-mobile-client: true`)로도 signup 이 403 되지 않는지 실측.

웹 경로는 `probe_signup_gate_prod.py` 가 본다. 앱은 CSRF 를 헤더로 우회하므로 경로가
갈라지고, 실제로 앱 요청이 헤더를 잃어 전량 조용히 버려진 이력이 있다.

**계정을 만들지 않는다** — 존재가 확인된 이메일로 보내 중복 검사(400)까지만 도달한다.
응답 상태코드·헤더·본문 원문을 그대로 출력한다(CEO 승인 조건).

사용: python3 scripts/qa/probe_signup_gate_prod_mobile.py
"""
import json
import sys
import urllib.error
import urllib.request

URL = 'https://www.ipjuhae.com/api/auth/signup'
EXISTING_EMAIL = 'ipjuhae.official@gmail.com'

payload = json.dumps(
    {'email': EXISTING_EMAIL, 'password': 'Qa-Probe-NotARealLogin-1234', 'userType': 'tenant'}
).encode()

req = urllib.request.Request(
    URL,
    data=payload,
    headers={
        'Content-Type': 'application/json',
        'User-Agent': 'ipjuhae-qa-dow1254-mobile',
        # 앱이 붙이는 헤더. middleware.ts:161 이 이 값으로 CSRF 를 우회시킨다.
        'x-mobile-client': 'true',
    },
    method='POST',
)

try:
    res = urllib.request.urlopen(req)
    status, headers, body = res.status, dict(res.headers), res.read().decode()
except urllib.error.HTTPError as e:
    status, headers, body = e.code, dict(e.headers), e.read().decode()

print(f'POST {URL}')
print('  헤더: x-mobile-client: true (Origin 없음 — 앱과 같은 형태)')
print(f'  상태코드: {status}')
print(f'  본문 원문: {body}')
interesting = {k: v for k, v in headers.items() if k.lower() in {'content-type', 'x-ratelimit-remaining', 'retry-after'}}
print(f'  응답 헤더(발췌): {interesting}')

try:
    parsed = json.loads(body)
    msg = parsed.get('error', '') if isinstance(parsed, dict) else ''
except json.JSONDecodeError:
    msg = ''

if status == 403:
    print('FAIL — 앱 경로가 403. 원인(게이트/CSRF)과 무관하게 운영 장애다. 즉시 보고할 것')
    sys.exit(1)
if '초대' in msg:
    print('FAIL — 초대 게이트가 살아 있다')
    sys.exit(1)
if status == 400 and '이미 사용 중인 이메일' in msg:
    print('PASS — 앱 경로도 게이트 없이 중복 검사까지 도달 (계정 생성 없음)')
    sys.exit(0)
if status in (200, 201):
    print('경고 — 계정이 생성됐을 수 있다. 즉시 확인 필요')
    sys.exit(1)
print('판정 불가 — 예상하지 않은 응답')
sys.exit(2)
