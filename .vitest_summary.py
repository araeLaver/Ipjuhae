import re, sys

path = sys.argv[1]
text = open(path, errors="replace").read()
text = re.sub(r"\x1b\[[0-9;]*m", "", text)
pat = re.compile(r"Test Files|^ Tests |FAIL |Duration|^ *[0-9]+\) |AssertionError|Test timed out")
for line in text.split("\n"):
    if pat.search(line):
        print(line[:220])
