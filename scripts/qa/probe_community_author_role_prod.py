#!/usr/bin/env python3
"""프로덕션 커뮤니티 author_role 값 집합 실측 프로브 (DOW-1268 / DOW-1262).

`probe_community_anonymity_prod.py` 와 나뉘는 지점: 저쪽은 **개인 식별 키가 있는지**를
중첩 키 경로까지 훑어 본다(DOW-1249). 이쪽은 **author_role 의 값**이 admin/member 로
접혔는지를 본다(DOW-1262). 키 유무와 값 집합은 다른 결함을 잡으므로 둘 다 남긴다.

공개 읽기 경로만 호출한다 — 계정 생성도, 쓰기도 없다.
판정 대상:
  1) author_role 값 집합이 {admin, member} 안에 있는가 (guest/tenant/landlord 0건)
  2) 운영자 글이 admin 으로 남아 있는가 (배지 소비처 생존)
  3) payload 에 author_name / author_id 가 없는가 (익명 고정)

실행:
  python3 scripts/qa/probe_community_anonymity_prod.py
  python3 scripts/qa/probe_community_anonymity_prod.py --base https://ipjuhae-production.fly.dev
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from collections import Counter

FORBIDDEN_ROLES = {"guest", "tenant", "landlord"}
ALLOWED_ROLES = {"admin", "member"}
FORBIDDEN_KEYS = {"author_name", "author_id", "authorName", "authorId"}


def get_json(base, path, timeout=30):
    req = urllib.request.Request(
        base + path,
        headers={
            "User-Agent": "ipjuhae-qa-probe/1.0 (DOW-1268)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://www.ipjuhae.com")
    ap.add_argument("--limit", type=int, default=50)
    args = ap.parse_args()
    base = args.base.rstrip("/")

    roles = Counter()          # 경로별 역할 값 집계
    per_path = {}              # path -> Counter
    leaked_keys = Counter()
    failures = []

    def tally(path, rows):
        c = per_path.setdefault(path, Counter())
        for row in rows:
            role = row.get("author_role", "<MISSING>")
            c[role] += 1
            roles[role] += 1
            for k in row:
                if k in FORBIDDEN_KEYS:
                    leaked_keys[f"{path}:{k}"] += 1

    st, data = get_json(base, f"/api/community/posts?limit={args.limit}")
    if st != 200:
        print(f"FAIL list status={st}")
        return 2
    posts = data.get("posts", [])
    tally("list", posts)
    print(f"list: {len(posts)}건, hasMore={data.get('hasMore')}")
    print(f"list payload keys: {sorted(posts[0].keys()) if posts else '(빈 목록)'}")

    for p in posts:
        pid = p["id"]
        try:
            st, d = get_json(base, f"/api/community/posts/{pid}")
            if st != 200:
                failures.append(f"detail {pid} status={st}")
                continue
            post = d.get("post", d)
            tally("detail", [post])
        except urllib.error.HTTPError as e:
            failures.append(f"detail {pid} HTTP {e.code}")
            continue

        try:
            st, d = get_json(base, f"/api/community/posts/{pid}/comments?limit=50")
            if st != 200:
                failures.append(f"comments {pid} status={st}")
                continue
            comments = d.get("comments", [])
            tally("comments", comments)
        except urllib.error.HTTPError as e:
            failures.append(f"comments {pid} HTTP {e.code}")

    print("\n=== author_role 값 집계 ===")
    for path in ("list", "detail", "comments"):
        c = per_path.get(path, Counter())
        print(f"{path:9s} {dict(c) if c else '(행 0건)'}")
    print(f"{'전체':9s} {dict(roles)}")

    bad = {r: n for r, n in roles.items() if r not in ALLOWED_ROLES}
    print("\n=== 판정 ===")
    ok = True
    if bad:
        print(f"FAIL 허용되지 않은 author_role: {bad}")
        ok = False
    else:
        print(f"PASS author_role 값 집합 ⊆ {sorted(ALLOWED_ROLES)}")
    forbidden_hit = {r: n for r, n in roles.items() if r in FORBIDDEN_ROLES}
    print(f"{'FAIL' if forbidden_hit else 'PASS'} guest/tenant/landlord: {forbidden_hit or '0건'}")
    if forbidden_hit:
        ok = False
    if leaked_keys:
        print(f"FAIL 익명화 위반 키: {dict(leaked_keys)}")
        ok = False
    else:
        print("PASS payload 에 author_name / author_id 없음")
    if failures:
        print(f"주의 요청 실패 {len(failures)}건: {failures[:5]}")
    print(f"\n{'PASS' if ok else 'FAIL'} (base={base})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
