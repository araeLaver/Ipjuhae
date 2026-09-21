import json, sys

md_path, out_path = sys.argv[1], sys.argv[2]
body = open(md_path, encoding="utf-8").read()
payload = {"body": body}
if len(sys.argv) > 3:
    payload["status"] = sys.argv[3]
    payload["comment"] = payload.pop("body")
open(out_path, "w", encoding="utf-8").write(json.dumps(payload, ensure_ascii=False))
print("wrote", out_path, len(body), "chars")
