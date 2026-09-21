import re, sys

path = sys.argv[1]
pats = ["void ", "setTimeout", "setInterval", ".catch(", ".then(", "queueMicrotask", "setImmediate"]
for i, line in enumerate(open(path, errors="replace").read().split("\n"), 1):
    if any(p in line for p in pats):
        print(i, line.strip()[:160])
