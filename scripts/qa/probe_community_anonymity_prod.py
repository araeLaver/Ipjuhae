"""DOW-1249 / DOW-1236 프로덕션 익명화 실측 프로브.

운영 서버(https://www.ipjuhae.com)의 커뮤니티 3개 API 응답 payload에
개인 식별 필드(author_name, author_id 등)가 없는지 실제 요청으로 확인한다.
소스 grep이 아니라 응답 키로만 판정한다.
출력에는 실제 개인 이름이나 원본 개인정보를 남기지 않는다 (키 목록과 비식별 결과만).
"""

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://www.ipjuhae.com"
# 응답에 있으면 안 되는 개인 식별 후보 키
FORBIDDEN = ("author_name", "author_id", "authorName", "authorId", "user_id", "userId", "name", "email", "phone")


def get(path):
    req = urllib.request.Request(
        BASE + path,
        headers={"User-Agent": "ipjuhae-qa-dow1249/1.0", "Accept": "application/json"},
    )
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")[:600]


def unwrap(body):
    d = json.loads(body)
    if isinstance(d, dict):
        for k in ("posts", "items", "data", "comments", "post"):
            if k in d:
                return d, d[k]
    return d, d


def keyscan(obj, prefix=""):
    """중첩 객체 전체의 키 경로를 모은다."""
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            keys.add(prefix + k)
            keys |= keyscan(v, prefix + k + ".")
    elif isinstance(obj, list):
        for v in obj[:5]:
            keys |= keyscan(v, prefix)
    return keys


def report(label, path, body):
    top, payload = unwrap(body)
    sample = payload[0] if isinstance(payload, list) and payload else payload
    allkeys = sorted(keyscan(sample))
    hits = [k for k in allkeys if k.split(".")[-1] in FORBIDDEN]
    print("### %s — GET %s" % (label, path))
    print("  top-level keys : %s" % (sorted(top.keys()) if isinstance(top, dict) else type(top).__name__,))
    print("  item keys      : %s" % (allkeys,))
    print("  개인식별 키 적중 : %s" % (hits if hits else "없음",))
    return sample, hits


def main():
    fails = []

    s, b = get("/api/community/posts?limit=5")
    print("LIST status=%s" % s)
    if s != 200:
        print("  body: %s" % b[:400])
        return 1
    top, posts = unwrap(b)
    if not posts:
        print("  게시글 0건 — 실측 불가")
        return 2
    sample, hits = report("목록", "/api/community/posts?limit=5", b)
    fails += [("list", h) for h in hits]

    # 표시 이름 필드(있어도 되는 것)를 비식별로 요약
    for p in posts[:5]:
        disp = p.get("display_name") or p.get("displayName") or p.get("author") or None
        print("  표시이름 샘플: %r / is_admin=%r" % (disp, p.get("is_admin", p.get("isAdmin"))))

    pid = posts[0].get("id")
    s2, b2 = get("/api/community/posts/%s" % pid)
    print("DETAIL status=%s" % s2)
    if s2 == 200:
        _, h2 = report("상세", "/api/community/posts/<id>", b2)
        fails += [("detail", h) for h in h2]
    else:
        print("  body: %s" % b2[:400])
        fails.append(("detail", "status=%s" % s2))

    s3, b3 = get("/api/community/posts/%s/comments" % pid)
    print("COMMENTS status=%s" % s3)
    if s3 == 200:
        _, h3 = report("댓글", "/api/community/posts/<id>/comments", b3)
        fails += [("comments", h) for h in h3]
    else:
        print("  body: %s" % b3[:400])
        fails.append(("comments", "status=%s" % s3))

    print("=== 판정 ===")
    if fails:
        print("FAIL %s" % fails)
        return 1
    print("PASS — 3개 엔드포인트 응답에 개인 식별 키 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
