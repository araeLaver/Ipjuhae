import io

path = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/packages/adapters/codex-local/src/server/process-budget-guard.test.ts"
new = '''import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readProcessBudgetSnapshot,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";

describe("local adapter process budget guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports env-forced process budget snapshots", async () => {
    const snapshot = await readProcessBudgetSnapshot({
      PAPERCLIP_PROCESS_BUDGET_LIMIT: "100",
      PAPERCLIP_PROCESS_BUDGET_USED: "75",
    } as NodeJS.ProcessEnv);

    expect(snapshot).toMatchObject({
      used: 75,
      limit: 100,
      free: 25,
      usedRatio: 0.75,
      source: "env",
    });
  });

  it("blocks before spawning when the process budget is exhausted", async () => {
    // The guard is a server-side policy decision and therefore reads the host
    // env, not the per-agent `opts.env` that is handed to the child process.
    // Agent env is allowlist-filtered before spawning, so tuning knobs passed
    // through `opts.env` never reach the guard.
    vi.stubEnv("PAPERCLIP_PROCESS_BUDGET_LIMIT", "100");
    vi.stubEnv("PAPERCLIP_PROCESS_BUDGET_USED", "90");
    vi.stubEnv("PAPERCLIP_PROCESS_BUDGET_MAX_USED_RATIO", "0.85");
    vi.stubEnv("PAPERCLIP_PROCESS_BUDGET_MIN_FREE", "20");

    await expect(
      runChildProcess("process-budget-test", "definitely-not-spawned", [], {
        cwd: process.cwd(),
        env: {},
        timeoutSec: 1,
        graceSec: 1,
        onLog: async () => {},
      }),
    ).rejects.toThrow(/Process budget guard blocked local adapter spawn: 90\\/100/);
  });

  it("ignores process budget knobs that only exist in the spawned child env", async () => {
    await expect(
      runChildProcess("process-budget-child-env", "definitely-not-spawned", [], {
        cwd: process.cwd(),
        env: {
          PAPERCLIP_PROCESS_BUDGET_LIMIT: "100",
          PAPERCLIP_PROCESS_BUDGET_USED: "90",
          PAPERCLIP_PROCESS_BUDGET_MAX_USED_RATIO: "0.85",
          PAPERCLIP_PROCESS_BUDGET_MIN_FREE: "20",
        },
        timeoutSec: 1,
        graceSec: 1,
        onLog: async () => {},
      }),
    ).rejects.toThrow(/Failed to start command "definitely-not-spawned"/);
  });
});
'''
with io.open(path, "w", encoding="utf-8") as f:
    f.write(new)
print("written", path)
