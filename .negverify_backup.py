import subprocess, os, re

D = '/Volumes/WorkDrive/Develop/45.paperclipai/paperclip'
SRC = os.path.join(D, 'packages/db/src')
legacy = os.path.join(SRC, 'backup-lib-legacy-scratch.ts')
test = os.path.join(SRC, 'backup-lib-legacy-scratch.test.ts')


def run(args, **kw):
    return subprocess.run(args, cwd=D, capture_output=True, text=True, **kw)


# 1. materialize the pre-fix implementation as a scratch module
old = run(['git', 'show', '171a066a5^:packages/db/src/backup-lib.ts']).stdout
assert 'const rows = await sql.unsafe' in old, 'did not get the pre-fix version'
open(legacy, 'w').write(old)

# 2. a scratch test with the same streaming assertions, pointed at the old module
new_test = open(os.path.join(SRC, 'backup-lib.test.ts')).read()
# keep only what the streaming test needs, and import from the legacy module
new_test = new_test.replace(
    'from "./backup-lib.js"',
    'from "./backup-lib-legacy-scratch.js"',
)
# drop the two tests we are not re-running here
new_test = re.sub(
    r'describe\("createBufferedTextFileWriter".*?\n\}\);\n\n',
    '',
    new_test,
    flags=re.S,
)
new_test = re.sub(
    r'  it\(\n    "backs up and restores large table payloads.*?\n    60_000,\n  \);\n\n',
    '',
    new_test,
    flags=re.S,
)
assert 'streams rows to disk' in new_test, 'streaming test missing'
assert 'backs up and restores large table payloads' not in new_test, 'failed to drop first test'
open(test, 'w').write(new_test)

try:
    r = run(['pnpm', 'exec', 'vitest', 'run',
             'packages/db/src/backup-lib-legacy-scratch.test.ts'], timeout=900)
    print('exit code:', r.returncode)
    tail = r.stdout[-3000:]
    print(tail)
    print()
    if r.returncode == 0:
        print('>>> NEGATIVE VERIFICATION FAILED: old code passed the new test — test is not load-bearing')
    else:
        print('>>> NEGATIVE VERIFICATION OK: old code fails the new test')
finally:
    for f in (legacy, test):
        if os.path.exists(f):
            os.remove(f)
    print('scratch files removed')
    print(run(['git', 'status', '--porcelain']).stdout)
