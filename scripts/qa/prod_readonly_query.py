#!/usr/bin/env python3
"""운영 DB 읽기 전용 집계 조회 (Fly 컨테이너 안에서 앱의 pg 드라이버를 쓴다).

왜 이 경로인가: 에이전트 셸에서 flyctl 이 `~/.fly/config.yml` 의 토큰을 못 읽어
`no access token available` 로 실패한다. 토큰을 FLY_API_TOKEN 으로 주입해 우회하고,
원격 셸 따옴표 문제를 피하려고 JS 를 base64 로 넘긴다.

**집계만 출력한다.** 행 내용·접속 문자열·개인정보는 찍지 않는다.

사용: python3 scripts/qa/prod_readonly_query.py <조회이름>
  signup-gate   DOW-1224 판정용: 특정 계정 존재 여부 + beta_config 값
"""
import base64
import os
import re
import subprocess
import sys

APP = 'ipjuhae-production'

QUERIES = {
    # DOW-1224: 베타 초대 게이트 제거를 프로덕션에서 판정하려면 (1) 중복 이메일 프로브에
    # 쓸 계정이 실제로 있는지, (2) 게이트가 걸려 있었을 조건(beta_enabled='true')인지를
    # 먼저 알아야 한다. 둘 다 아니면 프로브가 아무것도 구분하지 못한다.
    'signup-gate': r"""
const { Client } = require('/app/node_modules/pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('set search_path to ipjuhae, public');
  const admin = await c.query("select count(*)::int n from users where email = 'ipjuhae.official@gmail.com'");
  const beta = await c.query("select value from beta_config where key = 'beta_enabled'");
  const users = await c.query('select count(*)::int n from users');
  const mig = await c.query("select count(*)::int n from _migrations where name like '%043%' or name like '%044%'");
  console.log(JSON.stringify({
    adminAccountExists: admin.rows[0].n === 1,
    betaEnabled: beta.rows[0] ? beta.rows[0].value : null,
    userCount: users.rows[0].n,
    community043_044Applied: mig.rows[0].n,
  }));
  await c.end();
})().catch((e) => { console.log('QUERY_ERROR', e.message); process.exit(1); });
""",
}

name = sys.argv[1] if len(sys.argv) > 1 else ''
if name not in QUERIES:
    print(f'사용 가능한 조회: {", ".join(QUERIES)}')
    sys.exit(2)

token_match = re.search(
    r'^access_token:\s*(\S+)', open(os.path.expanduser('~/.fly/config.yml')).read(), re.M
)
if not token_match:
    print('~/.fly/config.yml 에서 access_token 을 찾지 못했다')
    sys.exit(1)

env = dict(os.environ)
env['FLY_API_TOKEN'] = token_match.group(1)

# flyctl ssh console -C 는 셸을 거치지 않는다. 공백으로 토큰을 쪼개고(`cd /app && …` 는
# "cd" 를 실행하려다 실패한다) **따옴표도 지워 버린다**. 그래서
#  - 공백 없는 3토큰으로 만들고
#  - 문자열 리터럴 대신 정규식 리터럴의 `.source` 로 따옴표를 아예 없애고
#  - cwd 에 기대지 않도록 모듈을 절대 경로로 require 한다.
# base64url 을 쓰는 이유: 표준 base64 의 `/` 가 정규식 리터럴을 끊는다.
b64 = base64.urlsafe_b64encode(QUERIES[name].encode()).decode()
cmd = f'node -e eval(Buffer.from(/{b64}/.source,/base64url/.source).toString())'
proc = subprocess.run(
    ['flyctl', 'ssh', 'console', '-a', APP, '-C', cmd],
    env=env,
    capture_output=True,
    text=True,
    timeout=180,
)
print(proc.stdout.strip() or '(빈 출력)')
if proc.returncode != 0:
    print('STDERR:', proc.stderr.strip()[:500])
sys.exit(proc.returncode)
