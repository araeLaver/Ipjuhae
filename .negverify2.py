import subprocess, os, re

D = '/Volumes/WorkDrive/Develop/45.paperclipai/paperclip'
SRC = os.path.join(D, 'packages/db/src')
legacy = os.path.join(SRC, 'backup-lib-legacy-scratch.ts')
test = os.path.join(SRC, 'backup-lib-legacy-scratch.test.ts')


def run(args, **kw):
    return subprocess.run(args, cwd=D, capture_output=True, text=True, **kw)


old = run(['git', 'show', '171a066a5^:packages/db/src/backup-lib.ts']).stdout
assert 'const rows = await sql.unsafe' in old, 'did not get pre-fix version'
open(legacy, 'w').write(old)

t = open(os.path.join(SRC, 'backup-lib.test.ts')).read()
t = t.replace('from "./backup-lib.js"', 'from "./backup-lib-legacy-scratch.js"')
# the child-process runner must also point at the legacy module
t = t.replace('"./backup-lib.ts"', '"./backup-lib-legacy-scratch.ts"')
t = re.sub(r'describe\("createBufferedTextFileWriter".*?\n\}\);\n\n', '', t, flags=re.S)
t = re.sub(
    r'  it\(\n    "backs up and restores large table payloads.*?\n    60_000,\n  \);\n',
    '', t, flags=re.S)
assert 'dumps a table far larger than the heap' in t
assert 'backs up and restores large table payloads' not in t
assert 'backup-lib-legacy-scratch.ts' in t
open(test, 'w').write(t)

try:
    r = run(['pnpm', 'exec', 'vitest', 'run',
             'packages/db/src/backup-lib-legacy-scratch.test.ts'], timeout=900)
    print('exit code:', r.returncode)
    print(r.stdout[-3500:])
    print()
    print('>>> NEGATIVE VERIFICATION ' +
          ('FAILED: old code passed — test is not load-bearing'
           if r.returncode == 0 else 'OK: old code fails the new test'))
finally:
    for f in (legacy, test):
        if os.path.exists(f):
            os.remove(f)
    print('scratch removed; tree:')
    print(run(['git', 'status', '--porcelain']).stdout)
