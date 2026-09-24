import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// QA-only: this worktree's server/node_modules is a symlink into the main
// checkout, so `@paperclipai/adapter-utils` resolves to unmodified source.
// Force the branch's own source so server tests exercise the actual change.
const adapterUtilsSrc = fileURLToPath(new URL("../packages/adapter-utils/src", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
  },
  resolve: {
    alias: [
      {
        find: /^@paperclipai\/adapter-utils\/(.*)$/,
        replacement: `${adapterUtilsSrc}/$1.ts`,
      },
    ],
  },
});
