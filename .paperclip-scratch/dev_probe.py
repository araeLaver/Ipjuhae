"""02_Ipjuhae dev 서버를 띄워 준비 시간을 재고 즉시 종료한다 (DOW-1179 재현 확인)."""
import os
import signal
import subprocess
import time
import urllib.error
import urllib.request

REPO = "/Volumes/WorkDrive/Develop/02_Ipjuhae"
PORT = "3102"
env = dict(os.environ)
env.pop("NODE_ENV", None)

log = open("/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch/dev-probe.log", "w")
start = time.time()
proc = subprocess.Popen(
    ["npx", "next", "dev", "-p", PORT],
    cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT,
    start_new_session=True,
)

ready_at = None
status = None
deadline = start + 180
while time.time() < deadline:
    if proc.poll() is not None:
        status = "dev server exited rc=%s" % proc.returncode
        break
    try:
        with urllib.request.urlopen("http://127.0.0.1:%s/" % PORT, timeout=5) as r:
            ready_at = time.time()
            status = "HTTP %s" % r.status
            break
    except urllib.error.HTTPError as e:
        ready_at = time.time()
        status = "HTTP %s" % e.code
        break
    except Exception:
        time.sleep(2)

if ready_at:
    print("ready in %.1fs -> %s" % (ready_at - start, status))
else:
    print("NOT ready after %.1fs (%s)" % (time.time() - start, status or "timeout"))

try:
    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
except ProcessLookupError:
    pass
time.sleep(2)
if proc.poll() is None:
    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
log.close()
print(open("/Volumes/WorkDrive/Develop/02_Ipjuhae/.paperclip-scratch/dev-probe.log").read()[-800:])
