p = '/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/packages/db/src/backup-lib.test.ts'
t = open(p).read()
orig = t

anchor = '''      } finally {
        await sourceSql.end();
        await restoreSql.end();
      }
    },
    60_000,
  );
});'''

new_test = '''      } finally {
        await sourceSql.end();
        await restoreSql.end();
      }
    },
    60_000,
  );

  it(
    "streams rows to disk while dumping instead of reading a whole table into memory first",
    async () => {
      const sourceConnectionString = await createTempDatabase();
      const backupDir = createTempDir("paperclip-db-backup-streaming-");
      const sourceSql = postgres(sourceConnectionString, { max: 1, onnotice: () => {} });

      try {
        await sourceSql.unsafe(`
          CREATE TABLE "public"."backup_stream_records" (
            "id" serial PRIMARY KEY,
            "payload" text NOT NULL
          );
        `);

        // ~48MB of payload: far more than the writer's 1MB flush threshold, so a
        // streaming dump must flush many times before it finishes.
        const payload = "y".repeat(8192);
        await sourceSql.unsafe(`
          INSERT INTO "public"."backup_stream_records" ("payload")
          SELECT $1 FROM generate_series(1, 6000)
        `, [payload]);

        // Sample the growing backup file while the dump runs. A dump that
        // materializes the table first blocks the event loop for the whole row
        // loop, so this sampler never gets to run and observes nothing.
        const observedSizes: number[] = [];
        const sampler = setInterval(() => {
          for (const name of fs.readdirSync(backupDir)) {
            const size = fs.statSync(path.join(backupDir, name)).size;
            if (size > 0) observedSizes.push(size);
          }
        }, 5);

        let result;
        try {
          result = await runDatabaseBackup({
            connectionString: sourceConnectionString,
            backupDir,
            retentionDays: 7,
            filenamePrefix: "paperclip-stream",
          });
        } finally {
          clearInterval(sampler);
        }

        expect(result.sizeBytes).toBeGreaterThan(40 * 1024 * 1024);

        // Partial writes must have been visible before the backup resolved, and
        // they must have grown over time rather than appearing in one shot.
        const partialSizes = observedSizes.filter((size) => size < result.sizeBytes);
        expect(partialSizes.length).toBeGreaterThanOrEqual(3);
        expect(Math.max(...partialSizes)).toBeGreaterThan(Math.min(...partialSizes));
      } finally {
        await sourceSql.end();
      }
    },
    120_000,
  );
});'''

assert t.count(anchor) == 1, 'anchor not unique'
t = t.replace(anchor, new_test)
assert t != orig
open(p, 'w').write(t)
print('added regression test to', p)
