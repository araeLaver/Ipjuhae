P = "/Volumes/WorkDrive/Develop/_runtime/dow-1171-backup/server/src/services/backup-health.ts"
s = open(P).read()

old = '''import { open, readdir } from "node:fs/promises";
import { join } from "node:path";

// Read only bounded file tails; backups can exceed Node's whole-file size limit.
export async function latestCompletedBackup(directory: string): Promise<number | null> {
  let names: string[];
  try { names = await readdir(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  for (const name of names.filter((name) => /^paperclip-\\d{8}-\\d{6}\\.sql$/.test(name)).sort().reverse()) {
    let file;
    try {
      file = await open(join(directory, name), "r");
      const stat = await file.stat();
      if (!stat.isFile()) continue;
      const tail = Buffer.alloc(Math.min(256, stat.size));
      await file.read(tail, 0, tail.length, stat.size - tail.length);
      if (/\\nCOMMIT;\\n(?:--> statement-breakpoint|-- paperclip statement breakpoint [0-9a-f-]{36})\\s*$/.test(tail.toString())) return stat.mtimeMs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    } finally { await file?.close(); }
  }
  return null;
}'''

new = '''import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { hasBackupCompletionMarker } from "@paperclipai/db";

// Completion is judged by the same marker the backup writer promotes on, so a
// dump can only count here if runDatabaseBackup would have renamed it.
// Only bounded file tails are read; backups exceed Node's whole-file limit.
export async function latestCompletedBackup(directory: string): Promise<number | null> {
  let names: string[];
  try { names = await readdir(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  for (const name of names.filter((name) => /^paperclip-\\d{8}-\\d{6}\\.sql$/.test(name)).sort().reverse()) {
    const path = join(directory, name);
    try {
      const info = await stat(path);
      if (!info.isFile()) continue;
      if (hasBackupCompletionMarker(path)) return info.mtimeMs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}'''

assert old in s
s = s.replace(old, new)
open(P, "w").write(s)
print("marker check deduped")
