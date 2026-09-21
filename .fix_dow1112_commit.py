import hashlib
import os
import subprocess

D = "/Volumes/WorkDrive/Develop/02_Ipjuhae"
EXPECTED_HEAD = "85f19495"

OTHERS = [
    "__tests__/api/account-delete-atomicity.test.ts",
    "__tests__/mobile/notification-permission-sync.test.ts",
    "docs/WORK_LOG_20260921_QA_DOW632_VERIFICATION.md",
]
MINE = ["scripts/check-public-disclosure-terms.mjs", "package.json"]

MSG = """chore(docs): 공개자료 용어 guard를 main에 이식

대외로 나가는 문서에서 과장 표현(특허 등록, 계약 가능성 보장 등)과 비밀
토큰(JWT_SECRET, DATABASE_URL 등)을 잡는 guard가 main에 없었다. main의
기존 guard는 check-shared-logic / check-test-suite-health / prelaunch-check
뿐이라 문서 검사는 전무했다.

원본(87a6b9d9)을 그대로 옮기면 즉시 죽는다. DEFAULT_BASE_FILES가 가리키는
지원사업 기준 문서 2건이 main에 없기 때문이다. 없는 기준 문서는 건너뛰되
어떤 문서가 빠졌는지 경고로 남긴다 — 조용히 좁아진 검사 범위가 통과로
보이는 쪽이 더 위험하다. 문서가 복원되면 자동으로 다시 대상이 된다.

라틴 토큰은 단어 경계를 요구하도록 고쳤다. `SQL`이 `PostgreSQL`과
`MySQL` 안쪽까지 물어서, docs/ 전수 점검 80건 중 26건이 이 오탐 하나였다.
검사 결과의 3분의 1이 노이즈면 목록 전체가 무시된다. 한글 용어는 조사가
붙으므로 부분 일치를 그대로 둔다.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"""


def run(*args, check=True):
    r = subprocess.run(args, cwd=D, capture_output=True, text=True)
    print("$", " ".join(args[:4]), "..." if len(args) > 4 else "")
    out = (r.stdout + r.stderr).strip()
    if out:
        print(out[:800])
    if check and r.returncode != 0:
        raise SystemExit("FAILED")
    return r


def head():
    return subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], cwd=D, capture_output=True, text=True
    ).stdout.strip()


def digest(rel):
    p = os.path.join(D, rel)
    if not os.path.exists(p):
        return "MISSING"
    return hashlib.sha256(open(p, "rb").read()).hexdigest()[:12]


before = {f: digest(f) for f in OTHERS}
print("다른 에이전트 파일 해시(전):", before)

if head() != EXPECTED_HEAD:
    raise SystemExit("HEAD가 %s에서 %s로 바뀌었습니다 — 중단" % (EXPECTED_HEAD, head()))

run("git", "reset", "--soft", "HEAD~1")
run("git", "restore", "--staged", "--", *OTHERS)
run("git", "commit", "-m", MSG)
run("git", "add", "--", *OTHERS)

after = {f: digest(f) for f in OTHERS}
print("다른 에이전트 파일 해시(후):", after)
print("내용 보존:", before == after)

run("git", "log", "--oneline", "-2")
run("git", "show", "--stat", "--oneline", "-s", "HEAD")
run("git", "show", "--name-only", "--format=", "HEAD")
run("git", "status", "--short")
