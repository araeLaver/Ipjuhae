import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { runChildProcess, runningProcesses } from "./server-utils.js";

// QA probe (not for commit): how long does cancel block for a child that DOES
// honour SIGTERM, and for one that exits on its own after spawning a survivor?
describe("cancel latency", () => {
  it("well-behaved child", async () => {
    vi.stubEnv("PAPERCLIP_DISABLE_PROCESS_BUDGET_GUARD", "true");
    const id = randomUUID();
    let ready!: () => void;
    const started = new Promise<void>((r) => { ready = r; });
    const result = runChildProcess(id, process.execPath,
      ["-e", "console.log('READY'); setInterval(()=>{},1000)"], {
      cwd: process.cwd(), env: {}, timeoutSec: 0, graceSec: 15,
      onLog: async (_s, c) => { if (c.includes("READY")) ready(); },
    });
    await started;
    const running = runningProcesses.get(id)!;
    const t0 = process.hrtime.bigint();
    await running.terminate();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    await result;
    console.log(`WELL_BEHAVED_CANCEL_MS=${ms.toFixed(0)} (graceSec=15)`);
    expect(ms).toBeLessThan(15000);
  }, 30000);
});
