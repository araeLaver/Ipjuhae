// runDatabaseBackup를 실제 postgres에 돌려 .part → .sql 승격과 완결 표식을 확인한다 (DOW-1171).
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import {
  BACKUP_PART_SUFFIX,
  hasBackupCompletionMarker,
  runDatabaseBackup,
} from "/Volumes/WorkDrive/Develop/_runtime/dow-1171-backup/packages/db/src/backup-lib.ts";

const base = process.argv[2]!;
const dbName = "paperclip_backup_probe";
const admin = postgres(base, { max: 1, onnotice: () => {} });
await admin`SELECT 1`;
await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
await admin.unsafe(`CREATE DATABASE ${dbName}`);
await admin.end();

const target = new URL(base);
target.pathname = `/${dbName}`;
const sql = postgres(target.toString(), { max: 1, onnotice: () => {} });
await sql.unsafe(`CREATE TABLE probe (id serial primary key, payload text not null)`);
await sql.unsafe(`INSERT INTO probe (payload) SELECT repeat('p', 512) FROM generate_series(1, 2000)`);
await sql.end();

const dir = mkdtempSync(join(tmpdir(), "paperclip-promote-probe-"));
const result = await runDatabaseBackup({
  connectionString: target.toString(),
  backupDir: dir,
  retentionDays: 7,
  filenamePrefix: "paperclip",
});

const files = readdirSync(dir);
console.log("files:", files.join(", "));
console.log("size:", result.sizeBytes);
console.log("marker:", hasBackupCompletionMarker(result.backupFile));
console.log("part left:", files.filter((f) => f.endsWith(BACKUP_PART_SUFFIX)).length);

const cleanup = postgres(base, { max: 1, onnotice: () => {} });
await cleanup.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
await cleanup.end();
