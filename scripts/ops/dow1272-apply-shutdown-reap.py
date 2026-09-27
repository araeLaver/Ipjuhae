#!/usr/bin/env python3
"""DOW-1272 — 서버 종료 시 자식 프로세스 그룹 회수 경로를 넣는다.

배경(실측):
- `runChildProcess` 는 `detached: true` 로 자식을 띄운다. 자식은 자기 프로세스
  그룹의 리더가 되므로 서버가 속한 그룹에 보내는 신호를 받지 않는다.
- `server/src/index.ts` 의 SIGINT/SIGTERM 핸들러는 텔레메트리와 임베디드
  postgres 만 정리하고 `process.exit(0)` 한다. `runningProcesses` 를 건드리지
  않는다. 따라서 **재시작할 때마다 실행 중이던 자식과 그 하위 트리가 통째로
  launchd(ppid=1) 로 재부모화되어 영구히 남는다.**
- server.log 기준 재시작 131회(09-15~09-19 매시 재기동 루프 109회 포함) 뒤
  `kern.maxprocperuid` 사용량이 2268/2666 까지 올라 가드가 2.5일간 fail-closed
  되었다. 09-24 호스트 재부팅 전까지 스스로 회복하지 못했다.

이 패치는 두 파일을 수정한다(멱등):
1. packages/adapter-utils/src/server-utils.ts
   - `terminateAllRunningProcesses()` 추가: 등록된 모든 런의 프로세스 그룹에
     SIGTERM 을 보내고, 정해진 예산 안에서 종료를 기다린 뒤 남은 그룹을
     SIGKILL 한다. 종료 경로에서 쓰기 위해 상한이 있는 것이 핵심이다.
2. server/src/index.ts
   - shutdown 핸들러에서 postgres 정리보다 **먼저** 위 함수를 호출한다.

용법: python3 scripts/ops/dow1272-apply-shutdown-reap.py [--revert]
"""
from __future__ import annotations

import sys

ROOT = "/Volumes/WorkDrive/Develop/45.paperclipai/paperclip"
UTILS = f"{ROOT}/packages/adapter-utils/src/server-utils.ts"
INDEX = f"{ROOT}/server/src/index.ts"

UTILS_ANCHOR = "export const runningProcesses = new Map<string, RunningProcess>();\n"

UTILS_ADDITION = '''
/**
 * Terminate every tracked child process group, bounded by a wall-clock budget.
 *
 * Children are spawned with `detached: true`, so they lead their own process
 * group and never receive a signal aimed at the server's group. Nothing else
 * signals them either: the server's SIGINT/SIGTERM handler used to exit without
 * touching this map, so every restart orphaned the in-flight children (and
 * their whole subtree) onto launchd, where they lived forever. 131 restarts
 * took `kern.maxprocperuid` from a few hundred to 2268/2666 and left the spawn
 * budget guard fail-closed for 2.5 days (DOW-1272).
 *
 * This is deliberately not `Promise.all(terminate())`: each `terminate()` waits
 * that run's full `graceSec` before escalating, and a shutdown path cannot wait
 * an unbounded amount of time. Instead: one SIGTERM sweep, one bounded wait,
 * one SIGKILL sweep for whatever is still standing.
 *
 * @returns how many process groups were signalled.
 */
export async function terminateAllRunningProcesses(
  opts: { graceMs?: number; log?: (message: string, meta?: Record<string, unknown>) => void } = {},
): Promise<number> {
  const graceMs = Math.max(0, opts.graceMs ?? 3000);
  const log = opts.log ?? (() => {});
  const entries = [...runningProcesses.entries()];
  if (entries.length === 0) return 0;

  const pids = entries
    .map(([runId, running]) => ({ runId, pid: running.child.pid }))
    .filter((entry): entry is { runId: string; pid: number } =>
      typeof entry.pid === "number" && entry.pid > 0,
    );

  // Returns true when the group still exists. `signal: 0` is the liveness
  // probe: ESRCH means gone, EPERM means alive but not ours to signal.
  const signalGroup = (pid: number, signal: NodeJS.Signals | 0): boolean => {
    if (process.platform === "win32") return false;
    try {
      process.kill(-pid, signal);
      return true;
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === "EPERM";
    }
  };

  log("terminating tracked child process groups before exit", { count: pids.length });
  for (const { pid } of pids) signalGroup(pid, "SIGTERM");

  const deadline = Date.now() + graceMs;
  let alive = pids;
  while (alive.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    alive = alive.filter(({ pid }) => signalGroup(pid, 0));
  }

  if (alive.length > 0) {
    log("child process groups survived SIGTERM; escalating to SIGKILL", {
      count: alive.length,
      runIds: alive.map((entry) => entry.runId),
    });
    for (const { pid } of alive) signalGroup(pid, "SIGKILL");
  }

  runningProcesses.clear();
  return pids.length;
}
'''

INDEX_ANCHOR = """    const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
      const telemetryClient = getTelemetryClient();
"""

INDEX_REPLACEMENT = """    const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
      // Reap tracked adapter children FIRST. They are spawned detached, so they
      // lead their own process group and survive this process unless we signal
      // them explicitly; every restart used to orphan them onto launchd and
      // burn a `kern.maxprocperuid` slot permanently (DOW-1272).
      try {
        const terminated = await terminateAllRunningProcesses({
          log: (message, meta) => logger.warn({ ...meta, signal }, message),
        });
        if (terminated > 0) {
          logger.info({ signal, terminated }, "Terminated tracked child process groups");
        }
      } catch (err) {
        logger.error({ err, signal }, "Failed to terminate tracked child process groups");
      }

      const telemetryClient = getTelemetryClient();
"""

IMPORT_ANCHOR = 'import { runningProcesses } from "./adapters/index.js";'


def read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def write(path: str, body: str) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(body)


def apply_utils() -> str:
    body = read(UTILS)
    if "terminateAllRunningProcesses" in body:
        return "skip (이미 적용됨)"
    if UTILS_ANCHOR not in body:
        raise SystemExit(f"anchor not found in {UTILS}")
    write(UTILS, body.replace(UTILS_ANCHOR, UTILS_ANCHOR + UTILS_ADDITION, 1))
    return "applied"


def apply_index() -> str:
    body = read(INDEX)
    if "terminateAllRunningProcesses" in body:
        return "skip (이미 적용됨)"
    if INDEX_ANCHOR not in body:
        raise SystemExit(f"anchor not found in {INDEX}")
    body = body.replace(INDEX_ANCHOR, INDEX_REPLACEMENT, 1)
    insert = (
        'import { terminateAllRunningProcesses } '
        'from "@paperclipai/adapter-utils/server-utils";'
    )
    if insert not in body:
        lines = body.split("\n")
        anchor_idx = next(
            idx for idx, line in enumerate(lines) if line.startswith('import { initTelemetry')
        )
        lines.insert(anchor_idx + 1, insert)
        body = "\n".join(lines)
    write(INDEX, body)
    return "applied"


def main() -> int:
    print("server-utils.ts :", apply_utils())
    print("index.ts        :", apply_index())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
