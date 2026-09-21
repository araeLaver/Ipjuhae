import json, importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ISSUE = "759f86c3-d6d6-4f5a-b23b-0635b95bf7cd"
s, r = m.call("GET", "/api/issues/" + ISSUE)
print("before:", r["status"], "execRun=", r.get("executionRunId"), "user=", r.get("assigneeUserId"))

if r.get("executionRunId"):
    s2, r2 = m.call("POST", "/api/issues/" + ISSUE + "/release", dict(agentId="f6b770fa-e6aa-49b4-8e02-82a63a57e3b8"))
    print("release", s2, str(r2)[:200])
    s3, r3 = m.call("GET", "/api/issues/" + ISSUE)
    print("after release:", r3["status"], "execRun=", r3.get("executionRunId"),
          "agent=", r3.get("assigneeAgentId"), "user=", r3.get("assigneeUserId"))
    if r3.get("assigneeUserId") != "local-board" or r3.get("assigneeAgentId"):
        s4, r4 = m.call("PATCH", "/api/issues/" + ISSUE,
                        dict(status="todo", assigneeAgentId=None, assigneeUserId="local-board"))
        print("re-route", s4, r4.get("status"), r4.get("assigneeUserId"))
