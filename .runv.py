import subprocess, sys
p = subprocess.run(["npx", "vitest", "run", *sys.argv[1:]], capture_output=True, text=True, cwd="/Volumes/WorkDrive/Develop/02_Ipjuhae")
out = (p.stdout or "") + "\n--- stderr ---\n" + (p.stderr or "")
print(out[-6000:])
print("exit", p.returncode)
