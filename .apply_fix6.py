import io

base = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/"

# 1. Export the shared allocator from the db package.
p = base + "packages/db/src/test-embedded-postgres.ts"
s = io.open(p, encoding="utf-8").read()
old = "async function getAvailablePort(): Promise<number> {"
new = "export async function reserveLoopbackTestPort(): Promise<number> {"
assert old in s
s = s.replace(old, new, 1)
s = s.replace("const port = await getAvailablePort();", "const port = await reserveLoopbackTestPort();")
assert "getAvailablePort" not in s, "stale reference remains"
io.open(p, "w", encoding="utf-8").write(s)
print("exported reserveLoopbackTestPort")

# 2. Re-export it from the db package index.
p = base + "packages/db/src/index.ts"
s = io.open(p, encoding="utf-8").read()
old = """  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,"""
new = """  getEmbeddedPostgresTestSupport,
  reserveLoopbackTestPort,
  startEmbeddedPostgresTestDatabase,"""
assert old in s
io.open(p, "w", encoding="utf-8").write(s.replace(old, new, 1))
print("re-exported from db index")

# 3. Re-export from the cli test helper.
p = base + "cli/src/__tests__/helpers/embedded-postgres.ts"
s = io.open(p, encoding="utf-8").read()
old = """  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,"""
new = """  getEmbeddedPostgresTestSupport,
  reserveLoopbackTestPort,
  startEmbeddedPostgresTestDatabase,"""
assert old in s
io.open(p, "w", encoding="utf-8").write(s.replace(old, new, 1))
print("re-exported from cli helper")

# 4. Point the cli e2e test at the shared allocator instead of its own copy.
p = base + "cli/src/__tests__/company-import-export-e2e.test.ts"
s = io.open(p, encoding="utf-8").read()
old = """async function getAvailablePort(): Promise<number> {
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
}

"""
assert old in s
s = s.replace(old, "", 1)
s = s.replace("await getAvailablePort()", "await reserveLoopbackTestPort()")

old_import = """  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";"""
new_import = """  reserveLoopbackTestPort,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";"""
assert old_import in s
s = s.replace(old_import, new_import, 1)
io.open(p, "w", encoding="utf-8").write(s)
print("cli e2e now uses shared allocator")
