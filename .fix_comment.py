import io

path = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip/server/vitest.config.ts"
src = io.open(path, encoding="utf-8").read()

old = """    // These two projects hold the suite's integration tests: they boot embedded
    // Postgres clusters, apply migrations, spawn real child processes, and pay
    // the module-graph transform for whatever a test lazily imports inside its
    // own body. All of that is charged to the test budget, and throughput for
    // it collapses once a full parallel run saturates the machine. Vitest's 5s
    // default is a unit-test bound and was producing failures that tracked
    // machine load rather than correctness. 20s matches the timeout the heavy
    // `beforeAll` hooks in these same files already declare."""
new = """    // This project holds most of the suite's integration tests: they boot
    // embedded Postgres clusters, apply migrations, spawn real child processes,
    // and pay the module-graph transform for whatever a test lazily imports
    // inside its own body. All of that is charged to the test budget, and
    // throughput for it collapses once a full parallel run saturates the
    // machine. Vitest's 5s default is a unit-test bound and was producing
    // failures that tracked machine load rather than correctness. 20s matches
    // the timeout the heavy `beforeAll` hooks in these same files already
    // declare; the fast unit-test projects keep the tighter default."""

assert old in src
io.open(path, "w", encoding="utf-8").write(src.replace(old, new, 1))
print("updated comment")
