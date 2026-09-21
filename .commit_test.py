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
    raise SystemExit('unexpected branch %r — aborting' % branch)

msg = """test(db): reproduce the backup OOM under a capped heap

171a066a5 fixed the crash but nothing in the suite would catch it coming back.
The existing "without materializing one giant string" test only covers the
writer; it passes against the unbounded-row version too.

First attempt asserted on write timing — that partial data reaches disk while
the dump is still running. That one is not load-bearing: the old code also
passes it, because the pendingWrite chain drains during the awaits that follow
the row loop, so the sampler still observes the file growing in steps. Dropped
it rather than ship a test that proves nothing.

What discriminates is the heap, so this measures the heap. The dump runs in a
child process capped at --max-old-space-size=128 over a ~240MB table. Reading
the table into an array cannot fit; streaming 500 rows at a time can.

Negative verification against 171a066a5^: fails with "JavaScript heap out of
memory" — the same V8 abort that has been killing the server hourly. Passes on
the fix. Full file: 3 passed.

Co-Authored-By: Paperclip <noreply@paperclip.ing>
"""

git('add', 'packages/db/src/backup-lib.test.ts')
print(git('commit', '-m', msg))
print('branch after:', git('rev-parse', '--abbrev-ref', 'HEAD'))
print(git('log', '--oneline', '-3'))
