import subprocess

D = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip"


def run(*args, check=True):
    r = subprocess.run(args, cwd=D, capture_output=True, text=True)
    print("$", " ".join(args))
    print((r.stdout + r.stderr).strip())
    if check and r.returncode != 0:
        raise SystemExit("FAILED: " + " ".join(args))
    return r


run("git", "rev-parse", "--abbrev-ref", "HEAD")

suite_files = [
    "packages/adapters/codex-local/src/server/process-budget-guard.test.ts",
    "server/src/__tests__/opencode-local-adapter-environment.test.ts",
    "ui/src/components/IssueDocumentsSection.test.tsx",
    "server/vitest.config.ts",
    "packages/db/src/test-embedded-postgres.ts",
    "packages/db/src/index.ts",
    "cli/src/__tests__/helpers/embedded-postgres.ts",
    "cli/src/__tests__/company-import-export-e2e.test.ts",
]
redaction_files = [
    "server/src/services/feedback-redaction.ts",
    "server/src/__tests__/feedback-redaction.test.ts",
]

msg1 = """test: remove the load-dependent failures from the suite

The suite had failures that tracked machine load rather than correctness,
which forced every reader to re-run with their changes stashed to tell a
real regression from a standing one.

- process-budget-guard: the guard reads host env on purpose since the agent
  env allowlist landed, so drive it with vi.stubEnv and add a regression test
  that the child-env knob stays ignored.
- opencode adapter diagnostics: testEnvironment recursively copied the
  developer's real ~/.config/opencode per call. Point every case at an empty
  config home, which also makes the assertions hermetic. 5027/5002/4646ms
  becomes 33/162/246ms.
- IssueDocumentsSection: wait on the rendered condition instead of a fixed
  number of macrotask ticks.
- embedded Postgres: draw ports from below the ephemeral range and verify the
  server on the port serves our own data directory. A wildcard bind on macOS
  succeeds alongside a loopback listener, so an HTTP test client could reach
  another worker's Postgres; identical credentials made a lost race silent.
- server and db projects: raise testTimeout to the 20s their own heavy
  beforeAll hooks already declare, leaving the unit-test projects at 5s.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"""

msg2 = """fix(feedback): stop the phone pattern from eating UUID segments

The phone redaction excluded only word characters at its boundaries, so a
digit-only run inside a longer hyphenated token matched on its own. The
middle segments of a UUID have exactly that shape:

  0a37527d-3236-4782-9cee-f1a7e99d7715
       ->  0a37527d-[REDACTED_PHONE]-9cee-f1a7e99d7715

6.85% of random v4 UUIDs are affected, measured over 200k samples. Because
sanitizeFeedbackText runs over the bodies, logs and adapter traces of every
shared feedback bundle, roughly one id in fifteen left mangled - destroying
the traceability the bundle exists to provide. It surfaced as an
intermittent test failure only because the fixture ids are random.

Excluding hyphens at the boundaries too means a partial match inside a
hyphenated token no longer qualifies. Whole phone numbers still redact,
since their hyphens sit inside the match rather than on its edges.

Co-Authored-By: Paperclip <noreply@paperclip.ing>"""

run("git", "add", "--", *suite_files)
run("git", "commit", "-m", msg1)
run("git", "add", "--", *redaction_files)
run("git", "commit", "-m", msg2)

run("git", "rev-parse", "--abbrev-ref", "HEAD")
run("git", "log", "--oneline", "-3")
run("git", "status", "--short")
