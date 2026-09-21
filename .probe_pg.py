import io

path = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/packages/db/src/test-embedded-postgres.ts"
src = io.open(path, encoding="utf-8").read()

marker = "TEMP_PORT_PROBE"
if marker in src:
    print("already patched")
    raise SystemExit(0)

old = """    const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
    await ensurePostgresDatabase(adminConnectionString, "paperclip");"""
new = """    const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
    // TEMP_PORT_PROBE
    try {
      const pg = (await import("postgres")).default;
      const probe = pg(adminConnectionString, { max: 1, onnotice: () => {} });
      const rows = await probe`show data_directory`;
      const actual = String(rows[0]?.data_directory ?? "");
      await probe.end({ timeout: 1 });
      fs.appendFileSync(
        "/tmp/pgports.log",
        `${tempDirPrefix}\\tport=${port}\\twant=${dataDir}\\tgot=${actual}\\tmatch=${actual.includes(path.basename(dataDir))}\\n`,
      );
    } catch (probeErr) {
      fs.appendFileSync("/tmp/pgports.log", `${tempDirPrefix}\\tport=${port}\\tPROBE_ERR=${String(probeErr)}\\n`);
    }
    await ensurePostgresDatabase(adminConnectionString, "paperclip");"""

assert old in src
src = src.replace(old, new, 1)
io.open(path, "w", encoding="utf-8").write(src)
print("patched")
