P = "/Volumes/WorkDrive/Develop/_runtime/dow-1171-backup/server/src/index.ts"
s = open(P).read()

old_import = "  runDatabaseBackup,"
assert old_import in s
s = s.replace(old_import, "  cleanupOrphanBackupParts,\n  runDatabaseBackup,", 1)

old_start = '''  if (config.databaseBackupEnabled) {
    const backupIntervalMs = config.databaseBackupIntervalMinutes * 60 * 1000;'''
new_start = '''  if (config.databaseBackupEnabled) {
    // A backup killed mid-write (OOM, SIGKILL) leaves its .part file behind.
    // Nothing else records that it happened — the process that would have logged
    // it is already gone — so say it here.
    const orphanedParts = cleanupOrphanBackupParts(config.databaseBackupDir, "paperclip");
    if (orphanedParts.length > 0) {
      logger.warn(
        { orphanedParts, backupDir: config.databaseBackupDir },
        "Removed unfinished database backups left by a previous process",
      );
    }

    const backupIntervalMs = config.databaseBackupIntervalMinutes * 60 * 1000;'''
assert old_start in s
s = s.replace(old_start, new_start)

open(P, "w").write(s)
print("server startup patched")
