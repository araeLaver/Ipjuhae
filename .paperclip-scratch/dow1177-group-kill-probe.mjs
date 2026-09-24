// QA probe: does a group-directed kill still reach agent children after
// `detached: true`? Simulates the server being stopped the way a terminal
// (Ctrl-C) or launchd stops it: a signal aimed at the whole process group.
//
// usage: node dow1177-group-kill-probe.mjs <detached:0|1>
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";

const detached = process.argv[2] === "1";

// Parent = stand-in for the Paperclip server. It ignores nothing special; its
// shutdown handler exits without touching runningProcesses, like index.ts does.
const parentSrc = `
  const { spawn } = require('node:child_process');
  const child = spawn(process.execPath, ['-e', "console.log('CHILD '+process.pid); setInterval(()=>{},1000)"], {
    detached: ${detached},
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  child.stdout.on('data', (d) => process.stdout.write(String(d)));
  process.on('SIGTERM', () => process.exit(0));
  console.log('SERVER ' + process.pid);
  setInterval(() => {}, 1000);
`;

// setsid puts the stand-in server in its own process group, so the group kill
// below hits exactly that job and nothing else on this machine.
const server = spawn("/usr/bin/env", ["python3", "-c",
  "import os,sys,subprocess; os.setsid(); p=subprocess.Popen([sys.argv[1],'-e',sys.argv[2]]); print('PGID',os.getpgid(0),flush=True); p.wait()",
  process.execPath, parentSrc], { stdio: ["ignore", "pipe", "inherit"] });

let buf = "";
let pgid = null;
let childPid = null;

server.stdout.on("data", (d) => {
  buf += String(d);
  const g = buf.match(/PGID (\d+)/);
  if (g) pgid = Number(g[1]);
  const c = buf.match(/CHILD (\d+)/);
  if (c) childPid = Number(c[1]);
});

const alive = (pid) => {
  try {
    return execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" }).trim().length > 0;
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await sleep(1500);
if (!pgid || !childPid) {
  console.log("PROBE SETUP FAILED", { pgid, childPid, buf });
  process.exit(1);
}

// This is the stop signal: aimed at the group, not a single pid.
process.kill(-pgid, "SIGTERM");
await sleep(1500);

const survived = alive(childPid);
console.log(`detached=${detached} childPid=${childPid} survivedGroupKill=${survived}`);
if (survived) {
  try { process.kill(childPid, "SIGKILL"); } catch {}
}
try { process.kill(-pgid, "SIGKILL"); } catch {}
