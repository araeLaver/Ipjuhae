import json, re, sys

path = sys.argv[1]
text = open(path, errors="replace").read()
text = re.sub(r"\x1b\[[0-9;]*m", "", text)
start = text.find('{"numTotalTestSuites"')
if start < 0:
    print("no json report found")
    sys.exit(1)
dec = json.JSONDecoder()
data, _ = dec.raw_decode(text[start:])
print("suites", data["numPassedTestSuites"], "/", data["numTotalTestSuites"],
      "tests", data["numPassedTests"], "/", data["numTotalTests"],
      "failed", data["numFailedTests"])
for res in data.get("testResults", []):
    failed = [t for t in res.get("assertionResults", []) if t.get("status") == "failed"]
    if failed or res.get("status") == "failed":
        print("\n=== FILE:", res.get("name"), "status:", res.get("status"))
        if res.get("message"):
            print("  file message:", res["message"][:1500])
        for t in failed:
            print("  -", t.get("fullName"))
            for m in t.get("failureMessages", []) or []:
                print("    ", m[:1200].replace("\n", "\n     "))
