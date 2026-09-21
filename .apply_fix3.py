import io

path = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/server/src/__tests__/opencode-local-adapter-environment.test.ts"
new = '''import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { testEnvironment } from "@paperclipai/adapter-opencode-local/server";

// `testEnvironment` copies the resolved XDG config home into a throwaway
// runtime config dir on every call. Pointed at a developer's real
// `~/.config/opencode` that is an unbounded recursive copy (megabytes here,
// more on other machines) plus a matching recursive delete, per test. Under a
// full parallel suite run that disk contention alone pushed these cases past
// the 5s default timeout, and it also made the results depend on whatever the
// host happened to have configured. Every case below points the adapter at an
// empty config home so the copy short-circuits and the checks stay hermetic.
let isolatedConfigHome: string;
let previousBudgetGuardFlag: string | undefined;

beforeAll(async () => {
  isolatedConfigHome = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-test-xdg-"));
  // Each spawn otherwise scans the whole host process table (`ps -axo user=`)
  // plus a sysctl read to enforce the spawn budget. That is a server runtime
  // policy, not something these diagnostics assert, and it is exactly the kind
  // of extra process work that gets slow when the suite saturates the machine.
  previousBudgetGuardFlag = process.env.PAPERCLIP_DISABLE_PROCESS_BUDGET_GUARD;
  process.env.PAPERCLIP_DISABLE_PROCESS_BUDGET_GUARD = "1";
});

afterAll(async () => {
  if (previousBudgetGuardFlag === undefined) {
    delete process.env.PAPERCLIP_DISABLE_PROCESS_BUDGET_GUARD;
  } else {
    process.env.PAPERCLIP_DISABLE_PROCESS_BUDGET_GUARD = previousBudgetGuardFlag;
  }
  await fs.rm(isolatedConfigHome, { recursive: true, force: true });
});

describe("opencode_local environment diagnostics", () => {
  it("reports a missing working directory as an error when cwd is absolute", async () => {
    const cwd = path.join(
      os.tmpdir(),
      `paperclip-opencode-local-cwd-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      "workspace",
    );

    await fs.rm(path.dirname(cwd), { recursive: true, force: true });

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "opencode_local",
      config: {
        command: process.execPath,
        cwd,
        env: {
          XDG_CONFIG_HOME: isolatedConfigHome,
        },
      },
    });

    expect(result.checks.some((check) => check.code === "opencode_cwd_invalid")).toBe(true);
    expect(result.checks.some((check) => check.level === "error")).toBe(true);
    expect(result.status).toBe("fail");
  });

  it("treats an empty OPENAI_API_KEY override as missing", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-env-empty-key-"));
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-host-value";

    try {
      const result = await testEnvironment({
        companyId: "company-1",
        adapterType: "opencode_local",
        config: {
          command: process.execPath,
          cwd,
          env: {
            OPENAI_API_KEY: "",
            XDG_CONFIG_HOME: isolatedConfigHome,
          },
        },
      });

      const missingCheck = result.checks.find((check) => check.code === "opencode_openai_api_key_missing");
      expect(missingCheck).toBeTruthy();
      expect(missingCheck?.hint).toContain("empty");
    } finally {
      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
      await fs.rm(cwd, { recursive: true, force: true });
    }
  });

  it("classifies ProviderModelNotFoundError probe output as model-unavailable warning", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-env-probe-cwd-"));
    const binDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-env-probe-bin-"));
    const fakeOpencode = path.join(binDir, "opencode");
    const script = [
      "#!/bin/sh",
      "echo 'ProviderModelNotFoundError: ProviderModelNotFoundError' 1>&2",
      "echo 'data: { providerID: \\"openai\\", modelID: \\"gpt-5.3-codex\\", suggestions: [] }' 1>&2",
      "exit 1",
      "",
    ].join("\\n");

    try {
      await fs.writeFile(fakeOpencode, script, "utf8");
      await fs.chmod(fakeOpencode, 0o755);

      const result = await testEnvironment({
        companyId: "company-1",
        adapterType: "opencode_local",
        config: {
          command: fakeOpencode,
          cwd,
          env: {
            XDG_CONFIG_HOME: isolatedConfigHome,
          },
        },
      });

      const modelCheck = result.checks.find((check) => check.code === "opencode_hello_probe_model_unavailable");
      expect(modelCheck).toBeTruthy();
      expect(modelCheck?.level).toBe("warn");
      expect(result.status).toBe("warn");
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
      await fs.rm(binDir, { recursive: true, force: true });
    }
  });
});
'''
with io.open(path, "w", encoding="utf-8") as f:
    f.write(new)
print("written", path)
