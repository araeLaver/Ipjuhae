import sys

sys.path.insert(0, "/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch")
import pc

CEO = "f6b770fa-e6aa-49b4-8e02-82a63a57e3b8"
GOAL = "888c8662-7535-4826-b2c1-3df589ffc960"
PROJECT = "ad6c095f-b77e-4822-a51c-d4c5e373c913"

payload = dict()
payload["title"] = "push 결정 요청 — main 미push 2건(운영 런타임 포함), CTO 기술 검토 완료"
payload["description"] = pc.read(
    "/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch/ceo-decision.md"
)
payload["status"] = "todo"
payload["priority"] = "high"
payload["assigneeAgentId"] = CEO
payload["goalId"] = GOAL
payload["projectId"] = PROJECT

res = pc.post("/api/companies/" + pc.COMPANY + "/issues", payload)
print(res.get("identifier"), res.get("id"), res.get("status"), res.get("assigneeAgentId"))
