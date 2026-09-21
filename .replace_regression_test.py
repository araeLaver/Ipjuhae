import re

p = '/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/packages/db/src/backup-lib.test.ts'
t = open(p).read()

# drop the non-load-bearing write-timing test added earlier
start = t.find('  it(\n    "streams rows to disk while dumping')
assert start != -1, 'bogus test not found'
end = t.find('    120_000,\n  );\n', start)
assert end != -1, 'bogus test end not found'
end += len('    120_000,\n  );\n')
t = t[:start] + t[end:]
assert 'streams rows to disk' not in t

new_test = '''
  it(
    "dumps a table far larger than the heap without running out of memory",
    async () => {
      const sourceConnectionString = await createTempDatabase();
      const backupDir = createTempDir("paperclip-db-backup-heap-");
      const sourceSql = postgres(sourceConnectionString, { max: 1, onnotice: () => {} });

      try {
        await sourceSql.unsafe(`
          CREATE TABLE "public"."backup_heap_records" (
            "id" serial PRIMARY KEY,
            "payload" text NOT NULL
          );
        `);

        // ~240MB of payload, dumped by a child process capped at a 128MB heap.
        // A dump that reads the table into an array before emitting cannot fit,
        // so this only passes while rows are streamed.
        const payload = "z".repeat(8192);
        await sourceSql.unsafe(
          `INSERT INTO "public"."backup_heap_records" ("payload")
           SELECT $1 FROM generate_series(1, 30000)`,
          [payload],
        );

        const runnerPath = path.join(createTempDir("paperclip-db-backup-runner-"), "runner.mts");
        fs.writeFileSync(
          runnerPath,
          `import { runDatabaseBackup } from ${JSON.stringify(path.resolve(import.meta.dirname, "./backup-lib.ts"))};
await runDatabaseBackup({
  connectionString: process.argv[2],
  backupDir: process.argv[3],
  retentionDays: 7,
  filenamePrefix: "paperclip-heap",
});
`,
          "utf8",
        );

        const tsxBin = path.resolve(import.meta.dirname, "../node_modules/.bin/tsx");
        const child = spawnSync(tsxBin, [runnerPath, sourceConnectionString, backupDir], {
          encoding: "utf8",
          env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=128" },
        });

        expect(child.stderr ?? "").not.toMatch(/JavaScript heap out of memory/);
        expect(child.status).toBe(0);

        const dumped = fs.readdirSync(backupDir);
        expect(dumped).toHaveLength(1);
        expect(fs.statSync(path.join(backupDir, dumped[0]!)).size).toBeGreaterThan(200 * 1024 * 1024);
      } finally {
        await sourceSql.end();
      }
    },
    300_000,
  );
'''

marker = '    60_000,\n  );\n'
i = t.rindex(marker) + len(marker)
t = t[:i] + new_test + t[i:]

# spawnSync import
old_imp = 'import fs from "node:fs";'
assert t.count(old_imp) == 1
t = t.replace(old_imp, 'import { spawnSync } from "node:child_process";\nimport fs from "node:fs";')

open(p, 'w').write(t)
print('replaced regression test')
