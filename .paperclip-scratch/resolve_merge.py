P = "/Volumes/WorkDrive/Develop/_runtime/dow-1171-backup/server/src/index.ts"
s = open(P).read()

conflict = '''<<<<<<< HEAD
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

=======
    setInterval(() => { void backupHealth?.refresh(); }, 60_000).unref();
>>>>>>> fix/dow-1170-health
'''

resolved = '''    // A backup killed mid-write (OOM, SIGKILL) leaves its .part file behind.
    // Nothing else records that it happened — the process that would have logged
    // it is already gone — so say it here.
    const orphanedParts = cleanupOrphanBackupParts(config.databaseBackupDir, "paperclip");
    if (orphanedParts.length > 0) {
      logger.warn(
        { orphanedParts, backupDir: config.databaseBackupDir },
        "Removed unfinished database backups left by a previous process",
      );
    }

    setInterval(() => { void backupHealth?.refresh(); }, 60_000).unref();
'''

assert conflict in s
s = s.replace(conflict, resolved)
assert "<<<<<<<" not in s and ">>>>>>>" not in s
open(P, "w").write(s)
print("conflict resolved")
