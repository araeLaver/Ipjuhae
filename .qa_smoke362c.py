"""DOW-362 3차 — /api/rental-risk/brief는 POST 전용·비인증이다. 출처 표기를 본다."""

import json
import urllib.error
import urllib.request

BASE = "https://www.ipjuhae.com"
body = {
    "address": "서울특별시 강남구 테헤란로 000",
    "complexName": "QA점검용",
    "areaM2": 59.9,
    "depositManwon": 5000,
    "monthlyRentManwon": 80,
}
req = urllib.request.Request(BASE + "/api/rental-risk/brief", data=json.dumps(body).encode(), method="POST")
req.add_header("content-type", "application/json")
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        st, txt = r.status, r.read().decode()
except urllib.error.HTTPError as e:
    st, txt = e.code, e.read().decode()

print("status:", st)
try:
    j = json.loads(txt)
except Exception:  # noqa: BLE001
    print("raw:", txt[:400])
    raise SystemExit

print("top-level keys:", sorted(j.keys()))
flat = json.dumps(j, ensure_ascii=False)
print("length:", len(flat))
for marker in ["샘플", "표본", "예시", "sample", "demo", "가상", "synthetic", "참고용", "실제"]:
    if marker in flat:
        print("  marker present:", marker)
print("\nfirst 1200 chars:\n", flat[:1200])
