#!/usr/bin/env python3
"""DOW-1224 — 프로덕션 signup 이 초대 토큰 없이도 정상 경로로 진행하는지 실측.

**계정을 만들지 않는다.** 이미 존재하는 계정 이메일로 요청해 중복 검사(400,
"이미 사용 중인 이메일입니다")까지 도달하는 것만 본다. 존재 여부는 사전에
`scripts/qa/prod_readonly_query.py signup-gate` 의 `adminAccountExists` 로 확인한다 —
없는 이메일로 쏘면 그 순간 운영 계정이 하나 생긴다.

한계(정직하게): 운영 `beta_config.beta_enabled` 가 `false` 이므로 이 프로브는 게이트
제거 전/후를 **구분하지 못한다**. 제거 전에도 같은 400 이 나왔다. 확인하는 것은
"초대 토큰 없는 요청이 403 으로 막히지 않고 일반 검증 경로로 간다" 하나다.

사용: python3 scripts/qa/probe_signup_gate_prod.py
"""
import json
import sys
import urllib.error
import urllib.request

URL = 'https://www.ipjuhae.com/api/auth/signup'
# 운영에 이미 있는 계정 (prod_readonly_query 로 존재 확인). 비밀번호는 이 계정의 것이
# 아니다 — 중복 검사가 비밀번호보다 먼저 돌기 때문에 인증 시도가 아니다.
EXISTING_EMAIL = 'ipjuhae.official@gmail.com'

payload = json.dumps(
    {'email': EXISTING_EMAIL, 'password': 'Qa-Probe-NotARealLogin-1234', 'userType': 'tenant'}
).encode()

# Origin 을 붙이는 이유: middleware 의 CSRF 검사가 mutation 요청에 same-origin 을 요구한다.
# 브라우저가 보내는 것과 같은 형태로 보내야 실제 웹 가입 경로를 재는 것이 된다
# (`x-mobile-client: true` 로 우회하면 앱 경로를 재게 되어 판정 대상이 달라진다).
req = urllib.request.Request(
    URL,
    data=payload,
    headers={
        'Content-Type': 'application/json',
        'User-Agent': 'ipjuhae-qa-dow1224',
        'Origin': 'https://www.ipjuhae.com',
        'Referer': 'https://www.ipjuhae.com/signup',
    },
    method='POST',
)

try:
    res = urllib.request.urlopen(req)
    status, body = res.status, res.read().decode()
except urllib.error.HTTPError as e:
    status, body = e.code, e.read().decode()

try:
    parsed = json.loads(body)
except json.JSONDecodeError:
    parsed = None

print(f'POST /api/auth/signup (초대 토큰 없음, 기존 계정 이메일) → {status}')
print(f'  응답 키: {sorted(parsed.keys()) if isinstance(parsed, dict) else "(JSON 아님)"}')
print(f'  error 문구: {parsed.get("error") if isinstance(parsed, dict) else body[:120]}')

msg = parsed.get('error', '') if isinstance(parsed, dict) else ''
if '초대' in msg:
    print('FAIL — 초대 게이트가 살아 있다')
    sys.exit(1)
if status == 403:
    # CSRF·rate limit 등 게이트와 무관한 차단. 통과로도 실패로도 적지 않는다.
    print('판정 불가 — 초대 게이트가 아닌 이유로 403 (요청 형태를 고칠 것)')
    sys.exit(2)
if status == 400 and '이미 사용 중인 이메일' in msg:
    print('PASS — 게이트 없이 중복 검사까지 도달 (계정 생성 없음)')
    sys.exit(0)
if status in (200, 201):
    print('경고 — 계정이 생성됐을 수 있다. 즉시 확인 필요')
    sys.exit(1)
print('판정 불가 — 예상하지 않은 응답')
sys.exit(2)
