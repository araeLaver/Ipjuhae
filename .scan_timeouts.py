import glob, re, os

roots = [
    "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/server/src/**/*.test.ts",
    "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/packages/db/src/**/*.test.ts",
]
pat = re.compile(r"\}, ?(\d[\d_]*)\)|timeout: ?(\d[\d_]*)")
for root in roots:
    for f in glob.glob(root, recursive=True):
        hits = []
        for i, line in enumerate(open(f, errors="replace").read().split("\n"), 1):
            m = pat.search(line)
            if m:
                hits.append((i, line.strip()[:110]))
        if hits:
            print("==", os.path.relpath(f, "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip"))
            for h in hits:
                print("  ", h[0], h[1])
