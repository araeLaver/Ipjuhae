#!/usr/bin/env python3
"""DOW-1272 — 종료 시 자식 회수의 전/후 대조 테스트를 Paperclip 저장소에 쓴다."""
from __future__ import annotations

PATH = (
    "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/server/src/__tests__/"
    "shutdown-child-process-reap.test.ts"
)

BODY = r'''import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runningProcesses } from "../adapters/index.ts";
import { runChildProcess } from "../adapters/utils.ts";
import { terminateAllRunningProcesses } from "@paperclipai/adapter-utils/server-utils";

// DOW-1272. Adapter children are spawned with `detached: true`, so each leads its
// own process group and never receives a signal aimed at the server's group. The
// server's SIGINT/SIGTERM handler used to exit without touching `runningProcesses`,
// so every restart orphaned the in-flight child AND its whole subtree onto launchd,
// where nothing ever reaped them. 131 restarts (109 of them an hourly crash loop on
// 2026-09-15..19) drove `kern.maxprocperuid` to 2268/2666 and left the spawn budget
// guard fail-closed for 2.5 days; only the 2026-09-24 host reboot cleared it.
//
// The first test is the CONTROL: it reproduces the leak by exiting the way the old
// shutdown path did. It must keep passing — if it ever fails, the leak is being
// masked by something else and the second test proves nothing.

const pids = new Set<number>();

function live(pid: number) {
  try {
    // Zombies stopped executing; only the direct parent can reap them.
    return !execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" })
      .trim()
      .startsWith("Z");
  } catch {
    return false;
  }
}

/** A TERM-resistant child that itself spawns a TERM-resistant grandchild. */
async function startResistantRun(graceSec = 1) {
  vi.stubEnv("PAPERCLIP_DISABLE_PROCESS_BUDGET_GUARD", "true");
  const runId = randomUUID();
  let ready!: () => void;
  const started = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let output = "";
  let grandchildPid = 0;

  const grandchild =
    "process.on('SIGTERM', () => {}); console.log('READY ' + process.pid); setInterval(() => {}, 1000);";
  const script = `
    const { spawn } = require('node:child_process');
    process.on('SIGTERM', () => {});
    spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: ['ignore', 'pipe', 'ignore'] })
      .stdout.once('data', (data) => { console.log(String(data).trim()); });
    setInterval(() => {}, 1000);
  `;

  const result = runChildProcess(runId, process.execPath, ["-e", script], {
    cwd: process.cwd(),
    env: {},
    timeoutSec: 0,
    graceSec,
    onLog: async (_stream, chunk) => {
      output += chunk;
      const match = output.match(/READY (\d+)/);
      if (match && !grandchildPid) {
        grandchildPid = Number(match[1]);
        pids.add(grandchildPid);
        ready();
      }
    },
  });

  await started;
  const running = runningProcesses.get(runId)!;
  const childPid = running.child.pid!;
  pids.add(childPid);
  return { runId, result, childPid, grandchildPid };
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  pids.clear();
  runningProcesses.clear();
});

describe.skipIf(process.platform === "win32")("server shutdown reclaims adapter child process groups", () => {
  it("CONTROL: clearing the registry without signalling leaves the whole subtree alive", async () => {
    const { childPid, grandchildPid } = await startResistantRun();

    // Exactly what the old shutdown path amounted to: drop the handles and exit.
    runningProcesses.clear();
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(live(childPid), "the leak: a detached child outlives the server").toBe(true);
    expect(live(grandchildPid), "and so does everything below it").toBe(true);
  }, 20000);

  it("terminateAllRunningProcesses() kills the TERM-resistant child and its grandchild", async () => {
    const { result, childPid, grandchildPid } = await startResistantRun();

    const terminated = await terminateAllRunningProcesses({ graceMs: 1500 });
    expect(terminated).toBe(1);
    expect(runningProcesses.size).toBe(0);

    await vi.waitFor(() => {
      expect(live(childPid)).toBe(false);
      expect(live(grandchildPid)).toBe(false);
    }, 10000);

    await result;
  }, 20000);

  it("stays inside its grace budget so shutdown cannot hang", async () => {
    await startResistantRun(30);

    const startedAt = process.hrtime.bigint();
    await terminateAllRunningProcesses({ graceMs: 1000 });
    const blockedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // The child ignores SIGTERM, so this is the escalation path: it must wait the
    // budget and then SIGKILL, never the run's own 30s graceSec.
    expect(blockedMs).toBeGreaterThanOrEqual(900);
    expect(blockedMs).toBeLessThan(4000);
  }, 20000);

  it("is a no-op with an empty registry", async () => {
    expect(await terminateAllRunningProcesses()).toBe(0);
  });
});
'''


def main() -> int:
    with open(PATH, "w", encoding="utf-8") as fh:
        fh.write(BODY)
    print("wrote", PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
