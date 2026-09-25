#!/usr/bin/env node
/**
 * DOW-1174 — 대조군 유효성 재검증 하네스.
 *
 * `__tests__/components/demo-network-isolation.test.tsx`의 대조군이 실제로
 * "감시기가 살아 있음"을 증명하는지 확인한다. 통과 출력만으로는 아무것도
 * 증명되지 않는다 — 격리를 깼을 때 **어느 쪽이 빨갛게 되는지**가 근거다.
 *
 * 변이 2개를 `lib/demo-isolation.ts`에 넣고 각각 기대 방향으로 실패하는지 본다.
 *
 *   A. 격리를 끈다        → demo 격리 단언 4건이 실패해야 한다 (대조군 2건은 통과)
 *   B. 대조 경로도 격리한다 → 대조군 2건이 실패해야 한다 (demo 격리 4건은 통과)
 *
 * B가 실패하지 않으면 대조 경로는 애초에 감시 대상 호출을 하지 않는다는 뜻이고,
 * 그 대조군은 "격리가 잘 돼서"가 아니라 "잴 것이 없어서" 통과하고 있던 것이다.
 *
 * 공유 워크트리라 stash를 쓰지 않는다. 원본을 메모리에 들고 finally에서 되돌린다.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TARGET = path.resolve("lib/demo-isolation.ts");
const SPEC = "__tests__/components/demo-network-isolation.test.tsx";

const CONTROL_TESTS = [
  "일반 경로에서 Providers를 마운트하면 analytics 호출이 관측된다",
  "PageContainer를 마운트하면 auth 조회가 관측된다",
];

const MUTATIONS = [
  {
    id: "A",
    label: "격리 해제 — isDemoIsolatedPath가 항상 false",
    // 격리 단언은 4건이지만 3건만 빨개진다. "demo 화면은 auth 조회를 하는 공통
    // shell에 의존하지 않는다"는 Providers 없이 페이지만 마운트하므로
    // isDemoIsolatedPath를 타지 않는다. 죽은 테스트가 아니라 다른 회귀
    // (demo 페이지를 PageContainer로 감싸는 것)를 지키는 것이다.
    expect: { failing: "isolation", count: 3 },
    apply: (src) =>
      src.replace(
        "  if (typeof pathname !== 'string' || pathname.length === 0) return false\n" +
          "  return pathname === DEMO_ISOLATED_PATH_PREFIX || pathname.startsWith(`${DEMO_ISOLATED_PATH_PREFIX}/`)",
        "  if (typeof pathname !== 'string' || pathname.length === 0) return false\n" +
          "  return false // [DOW-1174 변이 A]",
      ),
  },
  {
    id: "B",
    label: "대조 경로 격리 — /check 도 격리 대상에 포함",
    // 대조군은 2건이지만 경로 생존을 지키는 것은 1건뿐이다. PageContainer 쪽은
    // Header의 /api/auth/me가 isDemoIsolatedPath를 보지 않고 무조건 나가서
    // CONTROL_PATH가 죽은 주소가 돼도 통과한다. 경로 교체 판단은 1건 기준.
    expect: { failing: "control", count: 1 },
    apply: (src) =>
      src.replace(
        "  if (typeof pathname !== 'string' || pathname.length === 0) return false\n",
        "  if (typeof pathname !== 'string' || pathname.length === 0) return false\n" +
          "  if (pathname === '/check') return true // [DOW-1174 변이 B]\n",
      ),
  },
];

function runSpec() {
  try {
    const stdout = execFileSync("npx", ["vitest", "run", SPEC], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

/** vitest 요약줄에서 통과/실패 수를 읽는다. */
function summarize(out) {
  const line = out.split("\n").find((l) => l.trim().startsWith("Tests"));
  const failed = /(\d+) failed/.exec(line ?? "")?.[1] ?? "0";
  const passed = /(\d+) passed/.exec(line ?? "")?.[1] ?? "0";
  return { line: (line ?? "(요약줄 없음)").trim(), failed: Number(failed), passed: Number(passed) };
}

/** 실패한 테스트 이름이 대조군인지 격리 단언인지 가른다. */
function classifyFailures(out) {
  const failures = [...out.matchAll(/(?:×|✗|FAIL).*?>\s*(.+?)(?:\s+\d+ms)?$/gm)].map((m) => m[1].trim());
  const control = failures.filter((name) => CONTROL_TESTS.some((c) => name.includes(c)));
  return { failures, control, isolation: failures.filter((name) => !control.includes(name)) };
}

const original = readFileSync(TARGET, "utf8");
const results = [];

try {
  const base = runSpec();
  const baseSummary = summarize(base.out);
  results.push({ id: "기준선", label: "변이 없음", ...baseSummary, ok: baseSummary.failed === 0 });

  for (const mutation of MUTATIONS) {
    const mutated = mutation.apply(original);
    if (mutated === original) {
      results.push({ id: mutation.id, label: mutation.label, line: "변이 적용 실패 — 대상 문자열 불일치", ok: false });
      continue;
    }
    writeFileSync(TARGET, mutated);
    const run = runSpec();
    const summary = summarize(run.out);
    const { control, isolation } = classifyFailures(run.out);
    const actual = mutation.expect.failing === "control" ? control : isolation;
    const otherSide = mutation.expect.failing === "control" ? isolation : control;
    results.push({
      id: mutation.id,
      label: mutation.label,
      ...summary,
      ok: summary.failed === mutation.expect.count && actual.length === mutation.expect.count && otherSide.length === 0,
      failing: actual,
      leaked: otherSide,
    });
    writeFileSync(TARGET, original);
  }
} finally {
  writeFileSync(TARGET, original);
}

const restored = readFileSync(TARGET, "utf8") === original;
console.log(JSON.stringify({ restored, results }, null, 2));
process.exit(restored && results.every((r) => r.ok) ? 0 : 1);
