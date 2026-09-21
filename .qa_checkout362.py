import importlib.util

spec = importlib.util.spec_from_file_location("pcapi", ".pcapi.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

I = "be3c950a-de4f-4a21-aeb8-329bbddf5947"
A = "86126552-f14e-4f7f-b802-302d99bb7bc7"

s, d = m.call("POST", "/api/issues/%s/checkout" % I, {"agentId": A, "expectedStatuses": ["todo", "in_progress"]})
print(s, str(d)[:400])
