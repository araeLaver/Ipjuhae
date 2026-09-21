import importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
pc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pc)

ISSUE = "86a5fffd-0ba4-4ba3-959c-4fd11281eb41"
body = open(".dow1135-decision.md", encoding="utf-8").read()

print(pc.call("POST", "/api/issues/" + ISSUE + "/comments", {"body": body})[0])
print(pc.call("PATCH", "/api/issues/" + ISSUE, {
    "status": "done",
    "comment": "CEO 결정 완료 — UX 큐 승인, 하위 티켓 3건([DOW-1136](/DOW/issues/DOW-1136)·[DOW-1137](/DOW/issues/DOW-1137)·[DOW-1138](/DOW/issues/DOW-1138)) 배정으로 이 결정 이슈는 종결합니다. 후속은 각 티켓에서 진행하세요.",
})[0])
