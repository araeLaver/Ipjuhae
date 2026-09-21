import subprocess

D = '/Volumes/WorkDrive/Develop/45.paperclipai/paperclip'


def git(*args, check=True):
    r = subprocess.run(['git', '-C', D, *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit('FAILED: git %s\n%s\n%s' % (' '.join(args), r.stdout, r.stderr))
    return r.stdout.strip()


branch = git('rev-parse', '--abbrev-ref', 'HEAD')
print('branch before:', branch)
if branch != 'pending-restart':
    raise SystemExit('unexpected branch %r — aborting so we do not commit onto another agent branch' % branch)

msg = """fix(db): stream backup rows with a cursor so the hourly dump stops OOM-killing the server

The server has been dying every ~62 minutes since 2026-09-20 16:28 — 14 crashes,
all of them V8 FatalProcessOutOfMemory under an 8GB heap. Each crash takes every
in-flight agent heartbeat with it, which is why process_lost_retry kept firing.

The trigger is the hourly automatic DB backup: every dump finished 1-2 minutes
before a crash (08:18 backup -> 08:20 crash). runDatabaseBackup dumped rows with

    const rows = await sql.unsafe(`SELECT * FROM ${table}`).values();

which materializes an entire table as a JS array before emitting a single line.
The dump output is already 350MB and grows ~2MB/day, so the in-memory row
representation plus the generated INSERT strings blow past 8GB.

Two changes, both needed:

- Stream rows through postgres.js .cursor(500) instead of materializing. Heap use
  is now a function of batch size, not table size.
- Give the buffered writer a drain() and await it once per batch. emit() is
  synchronous and only chains onto pendingWrite, so a tight emit loop never
  yields to the event loop and every chunk piles up in that chain — the cursor
  alone would not have bounded memory.

The existing test ("without materializing one giant string") covered the writer
side of this from an earlier pass; the row side was still unbounded.

Verification: pnpm --filter @paperclipai/db exec tsc --noEmit clean;
packages/db/src/backup-lib.test.ts 2 passed.

Co-Authored-By: Paperclip <noreply@paperclip.ing>
"""

git('add', 'packages/db/src/backup-lib.ts')
print(git('commit', '-m', msg))
print('branch after:', git('rev-parse', '--abbrev-ref', 'HEAD'))
print(git('log', '--oneline', '-2'))
