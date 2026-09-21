import json
import os
import shutil
import subprocess
import tempfile

D = "/Volumes/WorkDrive/Develop/02_Ipjuhae"
SCRIPT = os.path.join(D, "scripts", "check-mobile-launch.mjs")


def build_sandbox(mutate_app=None, drop_theme=False, break_theme=False):
    root = tempfile.mkdtemp(prefix="mobile-guard-")
    os.makedirs(os.path.join(root, "mobile", "src"))
    # assets는 심볼릭 링크로 재사용 — 1024px PNG 5개를 복사할 이유가 없다.
    os.symlink(os.path.join(D, "mobile", "assets"), os.path.join(root, "mobile", "assets"))
    os.symlink(os.path.join(D, "node_modules"), os.path.join(root, "node_modules"))
    shutil.copytree(os.path.join(D, "scripts"), os.path.join(root, "scripts"))

    app = json.load(open(os.path.join(D, "mobile", "app.json"), encoding="utf-8"))
    if mutate_app:
        mutate_app(app["expo"])
    json.dump(app, open(os.path.join(root, "mobile", "app.json"), "w", encoding="utf-8"))

    if not drop_theme:
        theme = open(os.path.join(D, "mobile", "src", "theme.ts"), encoding="utf-8").read()
        if break_theme:
            theme = theme.replace("primary: '#F0663F'", "primary: BRAND_PRIMARY")
        open(os.path.join(root, "mobile", "src", "theme.ts"), "w", encoding="utf-8").write(theme)
    return root


def run(root):
    r = subprocess.run(
        ["node", "scripts/check-mobile-launch.mjs"], cwd=root, capture_output=True, text=True
    )
    return r.returncode, (r.stdout + r.stderr).strip()


CASES = [
    ("기준: 변경 없음 (통과해야 함)", {}, 0),
    ("adaptiveIcon 색 불일치", {"mutate_app": lambda e: e["android"]["adaptiveIcon"].__setitem__("backgroundColor", "#123456")}, 1),
    ("splash 배경색 불일치", {"mutate_app": lambda e: e["splash"].__setitem__("backgroundColor", "#ffffff")}, 1),
    ("splash 설정 전체 삭제", {"mutate_app": lambda e: e.pop("splash")}, 1),
    ("expo-notifications 플러그인 삭제", {"mutate_app": lambda e: e.__setitem__("plugins", [p for p in e["plugins"] if not (isinstance(p, list) and p[0] == "expo-notifications")])}, 1),
    ("bundleIdentifier 변경", {"mutate_app": lambda e: e["ios"].__setitem__("bundleIdentifier", "com.other.app")}, 1),
    ("apiUrl이 http", {"mutate_app": lambda e: e["extra"].__setitem__("apiUrl", "http://localhost:3000/api")}, 1),
    ("eas projectId 플레이스홀더", {"mutate_app": lambda e: e["extra"]["eas"].__setitem__("projectId", "your-project-id")}, 1),
    ("theme.ts 없음", {"drop_theme": True}, 1),
    ("theme.ts에서 색을 읽을 수 없음", {"break_theme": True}, 1),
]

ok = True
for label, kwargs, expected in CASES:
    root = build_sandbox(**kwargs)
    try:
        code, out = run(root)
    finally:
        shutil.rmtree(root, ignore_errors=True)
    verdict = "OK" if code == expected else "MISMATCH"
    if code != expected:
        ok = False
    first = [l for l in out.splitlines() if l.strip().startswith("-")]
    print("[%s] %-32s exit=%d (기대 %d) %s" % (verdict, label, code, expected, first[0].strip() if first else ""))

print()
print("전체 통과" if ok else "실패한 케이스가 있습니다")
