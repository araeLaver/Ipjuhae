import json, importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

s, r = m.call("GET", "/api/issues/5706c3b9-bf57-4a37-9d4b-969f6814a8bf")
new_id = r["identifier"]
print("new:", new_id, r["status"], r["assigneeAgentId"])

s, r2 = m.call("GET", "/api/issues/759f86c3-d6d6-4f5a-b23b-0635b95bf7cd")
print("DOW-1090:", r2["status"], "agent=", r2["assigneeAgentId"], "user=", r2["assigneeUserId"])

link = "/DOW/issues/" + new_id
body = (
    "## 링크 보정 — 실행 트랙 이슈\n\n"
    "앞 댓글에서 말씀드린 [DOW-780](/DOW/issues/DOW-780) 실행 트랙입니다: "
    "[" + new_id + "](" + link + ") — 사업개발 배정, 2026-10-08 게이트부터 11-19 마감까지 소유합니다.\n\n"
    "Q1(경기도 자격 근거) 회신이 오면 이 이슈에서 받아 판정을 확정하고, "
    "2026-10-08까지 미확인이면 그 자리에서 No-Go 전환합니다. **보드께서 추가로 하실 일은 없습니다.**"
)
s, r3 = m.call("POST", "/api/issues/759f86c3-d6d6-4f5a-b23b-0635b95bf7cd/comments", dict(body=body))
print("link comment", s, str(r3)[:120])
