import io

path = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/packages/db/src/test-embedded-postgres.ts"
src = io.open(path, encoding="utf-8").read()

# 1. Replace getAvailablePort with a private-range reservation helper.
old_port = '''async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate test port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}'''

new_port = '''// Deliberately below the OS ephemeral range (49152+ on macOS, 32768+ on Linux).
// Embedded Postgres binds 127.0.0.1:<port>, while supertest and friends bind a
// wildcard address on an ephemeral port. On macOS a wildcard bind succeeds even
// when that port already has a loopback-specific listener, and a connection to
// 127.0.0.1:<port> is then routed to the *loopback* listener. Drawing Postgres
// ports from the ephemeral pool therefore let an HTTP test client silently talk
// to a Postgres server in another worker — observed as "Parse Error: Expected
// HTTP/, RTSP/ or ICE/" and as request hangs. Keeping these ports out of that
// pool removes the overlap entirely.
const EMBEDDED_POSTGRES_PORT_MIN = 20_000;
const EMBEDDED_POSTGRES_PORT_MAX = 32_000;
const EMBEDDED_POSTGRES_PORT_ATTEMPTS = 200;

async function isPortFree(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function getAvailablePort(): Promise<number> {
  const span = EMBEDDED_POSTGRES_PORT_MAX - EMBEDDED_POSTGRES_PORT_MIN;
  for (let attempt = 0; attempt < EMBEDDED_POSTGRES_PORT_ATTEMPTS; attempt += 1) {
    const port = EMBEDDED_POSTGRES_PORT_MIN + Math.floor(Math.random() * span);
    if (await isPortFree(port)) return port;
  }
  throw new Error("Failed to allocate an embedded Postgres test port");
}

// Probing the port and then starting Postgres leaves a window where another
// worker can claim it. Credentials and database name are identical across test
// instances, so losing that race would otherwise succeed silently and hand two
// test files the same database - which shows up much later as cross-test data
// interference. Confirm the server answering on this port is the one we just
// started before handing the connection string out.
async function servesOwnDataDirectory(port: number, dataDir: string): Promise<boolean> {
  const pg = (await import("postgres")).default;
  const probe = pg(`postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`, {
    max: 1,
    onnotice: () => {},
  });
  try {
    const rows = await probe`show data_directory`;
    const reported = String((rows[0] as { data_directory?: string } | undefined)?.data_directory ?? "");
    return reported.length > 0 && path.basename(reported) === path.basename(dataDir);
  } catch {
    return false;
  } finally {
    await probe.end({ timeout: 1 }).catch(() => {});
  }
}'''

assert old_port in src
src = src.replace(old_port, new_port, 1)

# 2. Retry the whole start when the port turns out not to be ours.
old_start = '''export async function startEmbeddedPostgresTestDatabase(
  tempDirPrefix: string,
): Promise<EmbeddedPostgresTestDatabase> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), tempDirPrefix));
  const port = await getAvailablePort();
  const EmbeddedPostgres = await getEmbeddedPostgresCtor();
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: () => {},
    onError: () => {},
  });

  try {
    await instance.initialise();
    await instance.start();

    const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
    await ensurePostgresDatabase(adminConnectionString, "paperclip");
    const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
    await applyPendingMigrations(connectionString);

    return {
      connectionString,
      cleanup: async () => {
        await instance.stop().catch(() => {});
        fs.rmSync(dataDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await instance.stop().catch(() => {});
    fs.rmSync(dataDir, { recursive: true, force: true });
    throw new Error(
      `Failed to start embedded PostgreSQL test database: ${formatEmbeddedPostgresError(error)}`,
    );
  }
}'''

new_start = '''const EMBEDDED_POSTGRES_START_ATTEMPTS = 5;

export async function startEmbeddedPostgresTestDatabase(
  tempDirPrefix: string,
): Promise<EmbeddedPostgresTestDatabase> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), tempDirPrefix));
  const EmbeddedPostgres = await getEmbeddedPostgresCtor();
  let initialised = false;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < EMBEDDED_POSTGRES_START_ATTEMPTS; attempt += 1) {
    const port = await getAvailablePort();
    const instance = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "paperclip",
      password: "paperclip",
      port,
      persistent: true,
      initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
      onLog: () => {},
      onError: () => {},
    });

    try {
      // initdb only ever runs once; retries reuse the data directory on a new port.
      if (!initialised) {
        await instance.initialise();
        initialised = true;
      }
      await instance.start();

      if (!(await servesOwnDataDirectory(port, dataDir))) {
        throw new Error(`Port ${port} is served by a different Postgres instance`);
      }

      const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
      await ensurePostgresDatabase(adminConnectionString, "paperclip");
      const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
      await applyPendingMigrations(connectionString);

      return {
        connectionString,
        cleanup: async () => {
          await instance.stop().catch(() => {});
          fs.rmSync(dataDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      lastError = error;
      await instance.stop().catch(() => {});
    }
  }

  fs.rmSync(dataDir, { recursive: true, force: true });
  throw new Error(
    `Failed to start embedded PostgreSQL test database: ${formatEmbeddedPostgresError(lastError)}`,
  );
}'''

assert old_start in src
src = src.replace(old_start, new_start, 1)

io.open(path, "w", encoding="utf-8").write(src)
print("patched test-embedded-postgres.ts")
