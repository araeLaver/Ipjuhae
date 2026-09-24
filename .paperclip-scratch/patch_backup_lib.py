P = "/Volumes/WorkDrive/Develop/_runtime/dow-1171-backup/packages/db/src/backup-lib.ts"
s = open(P).read()

old_import = 'import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";'
new_import = '''import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";'''
assert old_import in s
s = s.replace(old_import, new_import)

# Completion marker helpers, placed right after STATEMENT_BREAKPOINT.
old_bp = 'const STATEMENT_BREAKPOINT = "-- paperclip statement breakpoint 69f6f3f1-42fd-46a6-bf17-d1d85f8f3900";'
new_bp = old_bp + '''

/**
 * A dump is only usable if the process lived long enough to write the final
 * COMMIT. A SIGABRT (OOM) mid-write leaves a file that is byte-for-byte
 * indistinguishable from a good backup by name, extension and mtime — which is
 * how 123 truncated dumps sat on disk unnoticed for 18 days.
 */
const BACKUP_COMPLETION_TAIL = /\\nCOMMIT;\\n(?:--> statement-breakpoint|-- paperclip statement breakpoint [0-9a-f-]{36})\\s*$/;
const COMPLETION_TAIL_BYTES = 256;
export const BACKUP_PART_SUFFIX = ".part";

/** Reads the tail of a finished dump and reports whether it ends in a completed transaction. */
export function hasBackupCompletionMarker(filePath: string): boolean {
  let fd: number | undefined;
  try {
    fd = openSync(filePath, "r");
    const size = statSync(filePath).size;
    const length = Math.min(COMPLETION_TAIL_BYTES, size);
    const tail = Buffer.alloc(length);
    readSync(fd, tail, 0, length, size - length);
    return BACKUP_COMPLETION_TAIL.test(tail.toString("utf8"));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/**
 * Removes `.part` files left behind by a backup whose process died before it
 * could clean up. Returns the names it removed so startup can log that the
 * previous backup was killed mid-write — otherwise nothing records it, because
 * the process that would have logged it is gone.
 */
export function cleanupOrphanBackupParts(backupDir: string, filenamePrefix = "paperclip"): string[] {
  if (!existsSync(backupDir)) return [];
  const removed: string[] = [];
  for (const name of readdirSync(backupDir)) {
    if (!name.startsWith(`${filenamePrefix}-`) || !name.endsWith(`.sql${BACKUP_PART_SUFFIX}`)) continue;
    try {
      unlinkSync(resolve(backupDir, name));
      removed.push(name);
    } catch {
      // A part file we cannot remove is still never mistaken for a backup.
    }
  }
  return removed;
}'''
assert old_bp in s
s = s.replace(old_bp, new_bp)

# Write to a .part file, promote only after the completion marker is verified.
old_open = '''  const backupFile = resolve(opts.backupDir, `${filenamePrefix}-${timestamp()}.sql`);
  const writer = createBufferedTextFileWriter(backupFile);'''
new_open = '''  const backupFile = resolve(opts.backupDir, `${filenamePrefix}-${timestamp()}.sql`);
  // Written under a .part name so a process death at any point leaves no file
  // that looks like a backup. Only a verified, completed dump gets renamed.
  const partFile = `${backupFile}${BACKUP_PART_SUFFIX}`;
  const writer = createBufferedTextFileWriter(partFile);'''
assert old_open in s
s = s.replace(old_open, new_open)

old_close = '''    await writer.close();

    const sizeBytes = statSync(backupFile).size;'''
new_close = '''    await writer.close();

    if (!hasBackupCompletionMarker(partFile)) {
      throw new Error(`Backup did not finish writing: ${basename(partFile)} has no completion marker`);
    }
    renameSync(partFile, backupFile);

    const sizeBytes = statSync(backupFile).size;'''
assert old_close in s
s = s.replace(old_close, new_close)

open(P, "w").write(s)
print("backup-lib patched")
