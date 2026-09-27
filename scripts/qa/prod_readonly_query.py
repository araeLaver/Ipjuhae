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
    # DOW-1268: 프로덕션 payload 의 author_role 이 전부 admin 으로 나오는데, 그것만으로는
    # 새 코드(CASE WHEN → admin/member)와 옛 코드(COALESCE → 원본 역할)를 구분할 수 없다.
    # 옛 코드에서도 운영자 글은 admin 이기 때문이다. 그래서 **작성자 원본 user_type 분포**를
    # 직접 세어, 프로덕션에 애초에 비운영자 작성 행이 있는지(=구분 가능한 입력이 있는지)를
    # 확정한다. 집계만 출력한다.
    'community-author-roles': r"""
const { Client } = require('/app/node_modules/pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('set search_path to ipjuhae, public');
  const posts = await c.query("select coalesce(u.user_type,'(null)') t, count(*)::int n from community_posts p left join users u on u.id = p.author_id group by 1 order by 2 desc");
  const comments = await c.query("select coalesce(u.user_type,'(null)') t, count(*)::int n from community_comments c2 left join users u on u.id = c2.author_id group by 1 order by 2 desc");
  const totals = await c.query("select (select count(*)::int from community_posts) posts, (select count(*)::int from community_comments) comments");
  console.log(JSON.stringify({
    postsByAuthorUserType: posts.rows,
    commentsByAuthorUserType: comments.rows,
    totals: totals.rows[0],
  }));
  await c.end();
})().catch((e) => { console.log('QUERY_ERROR', e.message); process.exit(1); });
""",
    # DOW-1268: 위 조회에서 비운영자(= user_type null) 작성 글 2건이 나왔는데 공개 목록에는
    # 18건만 잡힌다. 그 2건이 **왜** 안 보이는지(삭제/숨김/게시판 권한)를 알아야 그것을
    # 옛 코드와 새 코드를 구분하는 입력으로 쓸 수 있는지 판정된다. id·플래그만 출력한다.
    'community-hidden-authors': r"""
const { Client } = require('/app/node_modules/pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('set search_path to ipjuhae, public');
  const r = await c.query("select p.id, p.audience, (p.author_id is null) author_id_null, (p.deleted_at is not null) deleted, (p.hidden_at is not null) hidden, (u.id is null) user_missing, coalesce(u.user_type,'(null)') user_type from community_posts p left join users u on u.id = p.author_id where u.user_type is null or u.user_type <> 'admin' order by p.created_at");
  console.log(JSON.stringify({ nonAdminAuthoredPosts: r.rows }));
  await c.end();
})().catch((e) => { console.log('QUERY_ERROR', e.message); process.exit(1); });
""",
    # DOW-1268: 프로덕션 데이터에는 비운영자 작성 행이 하나도 없어서(2건은 soft-delete)
    # payload 만으로는 새 코드와 옛 코드를 구분할 수 없다. 그래서 **배포된 빌드 산출물**을
    # 직접 본다. 새 식 `CASE WHEN u.user_type` 이 있고 옛 식 `COALESCE(u.user_type,'guest')`
    # 가 없어야 배포가 먹은 것이다. 파일 경로와 출현 횟수만 출력한다.
    'deployed-sql-marker': r"""
const fs = require('fs');
const path = require('path');
const NEW = 'CASE WHEN u.user_type';
const OLD = "COALESCE(u.user_type, 'guest')";
const OLD2 = "COALESCE(u.user_type,'guest')";
const hits = { new: [], old: [] };
let scanned = 0;
const walk = (dir) => {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'cache') walk(p); continue; }
    if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
    let src = '';
    try { src = fs.readFileSync(p, 'utf8'); } catch (err) { continue; }
    scanned++;
    const n = src.split(NEW).length - 1;
    const o = (src.split(OLD).length - 1) + (src.split(OLD2).length - 1);
    if (n) hits.new.push({ file: p.replace('/app/', ''), count: n });
    if (o) hits.old.push({ file: p.replace('/app/', ''), count: o });
  }
};
walk('/app/.next/server');
console.log(JSON.stringify({
  scannedFiles: scanned,
  newExpr: hits.new,
  oldExpr: hits.old,
  verdict: hits.new.length > 0 && hits.old.length === 0 ? 'PASS-new-code-deployed' : 'FAIL-check-hits',
}));
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
