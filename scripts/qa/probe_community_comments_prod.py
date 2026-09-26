"""DOW-1249 보강 프로브 — 댓글이 실제로 있는 글을 찾아 댓글 payload 키를 실측한다.

목록 프로브는 댓글 0건인 글을 잡으면 댓글 응답이 빈 배열이라 판정 근거가 되지 못한다.
여기서는 comment_count > 0 인 글을 페이지를 넘겨 가며 찾아 댓글 키를 확인한다.
개인정보는 출력하지 않는다 (키 목록과 비식별 요약만).
"""

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://www.ipjuhae.com"
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


def main():
    target = None
    scanned = 0
    for page in range(1, 8):
        s, b = get("/api/community/posts?limit=20&page=%d" % page)
        if s != 200:
            print("목록 실패 page=%d status=%s" % (page, s))
            return 1
        d = json.loads(b)
        posts = d.get("posts", [])
        scanned += len(posts)
        for p in posts:
            if (p.get("comment_count") or 0) > 0:
                target = p
                break
        if target or not d.get("hasMore"):
            break

    print("스캔한 글 수: %d" % scanned)
    if not target:
        print("댓글이 달린 글이 프로덕션에 없음 — 댓글 payload 실측 불가")
        return 2

    pid = target["id"]
    print("대상 글: id=%s comment_count=%s author_role=%s" % (pid, target.get("comment_count"), target.get("author_role")))

    s, b = get("/api/community/posts/%s/comments" % pid)
    print("COMMENTS status=%s" % s)
    if s != 200:
        print(b[:400])
        return 1
    d = json.loads(b)
    print("top-level keys: %s" % sorted(d.keys()))
    comments = d.get("comments", [])
    print("댓글 수: %d" % len(comments))
    if not comments:
        print("응답 댓글 0건 — 실측 불가")
        return 2

    allkeys = set()
    roles = []
    for c in comments:
        allkeys |= set(c.keys())
        roles.append(c.get("author_role"))
    allkeys = sorted(allkeys)
    hits = [k for k in allkeys if k in FORBIDDEN]
    print("댓글 item keys: %s" % allkeys)
    print("author_role 분포: %s" % sorted(set(str(r) for r in roles)))
    print("개인식별 키 적중: %s" % (hits if hits else "없음"))
    print("=== 판정 ===")
    if hits:
        print("FAIL %s" % hits)
        return 1
    print("PASS — 댓글 응답에 개인 식별 키 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
