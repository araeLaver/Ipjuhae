P = "/Volumes/WorkDrive/Develop/_runtime/dow-1171-backup/packages/db/src/backup-lib.test.ts"
s = open(P).read()

old_import = 'import { spawnSync } from "node:child_process";'
new_import = 'import { spawn, spawnSync } from "node:child_process";'
assert old_import in s
s = s.replace(old_import, new_import)

old_named = 'import { createBufferedTextFileWriter, runDatabaseBackup, runDatabaseRestore } from "./backup-lib.js";'
new_named = (
    "import {\n"
    "  BACKUP_PART_SUFFIX,\n"
    "  cleanupOrphanBackupParts,\n"
    "  createBufferedTextFileWriter,\n"
    "  hasBackupCompletionMarker,\n"
    "  runDatabaseBackup,\n"
    "  runDatabaseRestore,\n"
    '} from "./backup-lib.js";'
)
assert old_named in s
s = s.replace(old_named, new_named)

block = '''
describe("hasBackupCompletionMarker", () => {
  it("accepts a dump that ends in a committed transaction", () => {
    const dir = createTempDir("paperclip-marker-ok-");
    const file = path.join(dir, "paperclip-20260924-000000.sql");
    fs.writeFileSync(
      file,
      "INSERT INTO t VALUES (1);\\n-- paperclip statement breakpoint 69f6f3f1-42fd-46a6-bf17-d1d85f8f3900\\nCOMMIT;\\n-- paperclip statement breakpoint 69f6f3f1-42fd-46a6-bf17-d1d85f8f3900\\n",
      "utf8",
    );
    expect(hasBackupCompletionMarker(file)).toBe(true);
  });

  it("rejects a dump cut off mid-statement and a missing file", () => {
    const dir = createTempDir("paperclip-marker-bad-");
    const truncated = path.join(dir, "paperclip-20260903-105801.sql");
    fs.writeFileSync(truncated, "INSERT INTO heartbeat_run_events VALUES ($paperclip$partial", "utf8");
    expect(hasBackupCompletionMarker(truncated)).toBe(false);
    expect(hasBackupCompletionMarker(path.join(dir, "absent.sql"))).toBe(false);
  });
});

describe("unfinished backups", () => {
  it(
    "leaves no .sql behind when the writing process is SIGKILLed, and startup cleans the part file",
    async () => {
      const backupDir = createTempDir("paperclip-kill-during-backup-");
      const runnerDir = createTempDir("paperclip-kill-runner-");
      const runnerPath = path.join(runnerDir, "runner.mts");
      const target = path.join(backupDir, `paperclip-20260924-000000.sql${BACKUP_PART_SUFFIX}`);
      fs.writeFileSync(
        runnerPath,
        `import { createBufferedTextFileWriter } from ${JSON.stringify(path.resolve(import.meta.dirname, "./backup-lib.ts"))};
const writer = createBufferedTextFileWriter(${JSON.stringify(target)});
writer.emit("BEGIN;");
for (let i = 0; i < 40000; i += 1) writer.emit("INSERT INTO t VALUES (" + i + ");");
await writer.drain();
process.stdout.write("writing\\\\n");
await new Promise(() => {});
`,
        "utf8",
      );

      const tsxBin = path.resolve(import.meta.dirname, "../node_modules/.bin/tsx");
      const child = spawn(tsxBin, [runnerPath], { stdio: ["ignore", "pipe", "pipe"] });
      try {
        await new Promise<void>((resolveReady, rejectReady) => {
          const timer = setTimeout(() => rejectReady(new Error("runner never started writing")), 60_000);
          child.stdout.on("data", (chunk: Buffer) => {
            if (chunk.toString().includes("writing")) {
              clearTimeout(timer);
              resolveReady();
            }
          });
          child.once("error", (error) => {
            clearTimeout(timer);
            rejectReady(error);
          });
        });

        child.kill("SIGKILL");
        await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));

        // The process died with no chance to run catch/finally — exactly the OOM case.
        const afterKill = fs.readdirSync(backupDir);
        expect(afterKill.filter((name) => name.endsWith(".sql"))).toEqual([]);
        expect(afterKill).toContain(path.basename(target));

        expect(cleanupOrphanBackupParts(backupDir, "paperclip")).toEqual([path.basename(target)]);
        expect(fs.readdirSync(backupDir)).toEqual([]);
      } finally {
        child.kill("SIGKILL");
      }
    },
    120_000,
  );

  it("ignores unrelated files when cleaning part files", () => {
    const backupDir = createTempDir("paperclip-part-cleanup-");
    const keep = path.join(backupDir, "paperclip-20260924-000000.sql");
    fs.writeFileSync(keep, "COMMIT;", "utf8");
    fs.writeFileSync(path.join(backupDir, "notes.txt"), "keep me", "utf8");
    fs.writeFileSync(path.join(backupDir, `other-20260924-000000.sql${BACKUP_PART_SUFFIX}`), "", "utf8");

    expect(cleanupOrphanBackupParts(backupDir, "paperclip")).toEqual([]);
    expect(fs.readdirSync(backupDir).sort()).toEqual([
      "notes.txt",
      "other-20260924-000000.sql.part",
      "paperclip-20260924-000000.sql",
    ]);
  });
});
'''

marker = 'describeEmbeddedPostgres("runDatabaseBackup", () => {'
assert marker in s
s = s.replace(marker, block.lstrip("\n") + "\n" + marker)

# A completed backup must promote its part file and carry the marker.
old_assert = '''        expect(result.backupFile).toMatch(/paperclip-test-.*\\.sql$/);
        expect(result.sizeBytes).toBeGreaterThan(1024 * 1024);
        expect(fs.existsSync(result.backupFile)).toBe(true);'''
new_assert = '''        expect(result.backupFile).toMatch(/paperclip-test-.*\\.sql$/);
        expect(result.sizeBytes).toBeGreaterThan(1024 * 1024);
        expect(fs.existsSync(result.backupFile)).toBe(true);
        expect(hasBackupCompletionMarker(result.backupFile)).toBe(true);
        expect(fs.readdirSync(backupDir).filter((name) => name.endsWith(BACKUP_PART_SUFFIX))).toEqual([]);'''
assert old_assert in s
s = s.replace(old_assert, new_assert)

open(P, "w").write(s)
print("tests written")
