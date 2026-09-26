"""gemini CLI가 API 키 없이 기존 Google 로그인(OAuth 무료 티어)으로 돌 수 있는지 확인한다 (DOW-1248).

파괴적 변경 없음: 임시 HOME에 ~/.gemini의 자격증명만 복사하고 settings만 oauth-personal로 바꿔 1회 호출한다.
사용자의 ~/.gemini/settings.json은 건드리지 않는다.

기대 결과 3종
- exit 0            : OAuth 경로 사용 가능 → 3번째 실행 풀 확보 가능
- exit 41           : 여전히 API 키 요구 (settings 오버라이드 실패)
- IneligibleTierError: Google이 개인용 무료 Code Assist를 닫았음 → API 키 발급만이 유일한 길
"""
import json, os, shutil, subprocess, tempfile

SRC = os.path.expanduser("~/.gemini")
home = tempfile.mkdtemp(prefix="gemini-oauth-probe-")
gdir = os.path.join(home, ".gemini")
os.makedirs(gdir)
for name in ("oauth_creds.json", "google_accounts.json", "installation_id"):
    src = os.path.join(SRC, name)
    if os.path.exists(src):
        shutil.copy2(src, os.path.join(gdir, name))
json.dump({"security": {"auth": {"selectedType": "oauth-personal"}}},
          open(os.path.join(gdir, "settings.json"), "w"))

env = {k: v for k, v in os.environ.items() if k not in ("GEMINI_API_KEY", "GOOGLE_API_KEY")}
env["HOME"] = home
try:
    r = subprocess.run(["gemini", "-m", "gemini-2.5-flash", "-p", "Reply with exactly: OK"],
                       capture_output=True, text=True, env=env, cwd="/tmp", timeout=180)
    print("exit", r.returncode)
    print("stdout:", r.stdout[:500])
    print("stderr:", r.stderr[:900])
finally:
    shutil.rmtree(home, ignore_errors=True)
