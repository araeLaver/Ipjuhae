import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runningProcesses } from "../adapters/index.ts";
import { runChildProcess } from "../adapters/utils.ts";

// heartbeat.ts cancels a run with `await runningProcesses.get(id).terminate()`.
// That contract crosses the package boundary (server -> @paperclipai/adapter-utils),
// so a stale or mismatched adapter-utils fails here at runtime, not at typecheck.

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

describe.skipIf(process.platform === "win32")("cancel path reclaims the run's process group", () => {
  it("terminate() from the server re-export kills a TERM-resistant grandchild", async () => {
    vi.stubEnv("PAPERCLIP_DISABLE_PROCESS_BUDGET_GUARD", "true");
    const runId = randomUUID();
    let ready!: () => void;
    const started = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let output = "";

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
      graceSec: 1,
      onLog: async (_stream, chunk) => {
        output += chunk;
        const match = output.match(/READY (\d+)/);
        if (match) {
          pids.add(Number(match[1]));
          ready();
        }
      },
    });

    await started;

    const running = runningProcesses.get(runId);
    expect(running, "the server re-export must expose the live run").toBeDefined();
    if (running?.child.pid) pids.add(running.child.pid);
    // The exact call heartbeat.ts:3861 makes. A stale adapter-utils throws here.
    expect(typeof running?.terminate, "cancel needs terminate() on the tracked run").toBe("function");

    await running!.terminate();

    const completed = await result;
    expect(completed.exitCode).toBe(null);
    expect(runningProcesses.has(runId)).toBe(false);

    await vi.waitFor(() => {
      for (const pid of pids) expect(live(pid)).toBe(false);
    });
  }, 15000);

  it("bounds how long cancel blocks by graceSec", async () => {
    vi.stubEnv("PAPERCLIP_DISABLE_PROCESS_BUDGET_GUARD", "true");
    const runId = randomUUID();
    let ready!: () => void;
    const started = new Promise<void>((resolve) => {
      ready = resolve;
    });

    const graceSec = 2;
    const script =
      "process.on('SIGTERM', () => {}); console.log('READY'); setInterval(() => {}, 1000);";

    const result = runChildProcess(runId, process.execPath, ["-e", script], {
      cwd: process.cwd(),
      env: {},
      timeoutSec: 0,
      graceSec,
      onLog: async (_stream, chunk) => {
        if (chunk.includes("READY")) ready();
      },
    });

    await started;
    const running = runningProcesses.get(runId)!;
    if (running.child.pid) pids.add(running.child.pid);

    const startedAt = process.hrtime.bigint();
    await running.terminate();
    const blockedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    await result;

    // A TERM-resistant child holds the caller for the full grace window and no
    // longer: heartbeat cancel/pause await this inline on the request path.
    expect(blockedMs).toBeGreaterThanOrEqual(graceSec * 1000 * 0.8);
    expect(blockedMs).toBeLessThan(graceSec * 1000 + 3000);
  }, 15000);
});
