import sys, json, importlib.util, os

spec = importlib.util.spec_from_file_location(
    "pc", os.path.join(os.path.dirname(os.path.abspath(__file__)), "pc.py")
)
pc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pc)

method, path, payload_file = sys.argv[1], sys.argv[2], sys.argv[3]
with open(payload_file, encoding="utf-8") as f:
    body = json.load(f)
print(json.dumps(pc.call(method, path, body), ensure_ascii=False)[:2000])
