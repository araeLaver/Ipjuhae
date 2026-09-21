import json, importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

COMPANY = "0662097f-7363-4fc0-ac51-45798f6dddf0"
BIZDEV = "0e0caae7-877a-407d-b47a-94bf0c445e36"

desc = open(".new780track.md", encoding="utf-8").read()

payload = dict(
    title="경기 스타트업 지원센터 법률상담 접수 실행 트랙 — 2026-10-08 게이트 ~ 11-19 마감",
    description=desc,
    status="todo",
    priority="high",
    projectId="ad6c095f-b77e-4822-a51c-d4c5e373c913",
    goalId="888c8662-7535-4826-b2c1-3df589ffc960",
    assigneeAgentId=BIZDEV,
)
s, r = m.call("POST", "/api/companies/" + COMPANY + "/issues", payload)
print("create", s)
print(json.dumps(r, ensure_ascii=False)[:600] if isinstance(r, dict) else str(r)[:600])
