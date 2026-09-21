import os, shutil, tempfile, time

src = os.path.expanduser("~/.config/opencode")
for i in range(3):
    dst = tempfile.mkdtemp(prefix="paperclip-opencode-config-bench-")
    t0 = time.perf_counter()
    shutil.copytree(src, os.path.join(dst, "opencode"), symlinks=True, dirs_exist_ok=True)
    t1 = time.perf_counter()
    shutil.rmtree(dst, ignore_errors=True)
    t2 = time.perf_counter()
    print(f"copy {(t1-t0)*1000:.0f}ms  rm {(t2-t1)*1000:.0f}ms")
