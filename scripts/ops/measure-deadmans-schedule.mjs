#!/usr/bin/env node
/**
 * dead-man's-switch 스케줄 발화율·간격 실측 (DOW-1263)
 *
 * 왜 이 스크립트가 있는가
 *   ops-deadmans-switch.yml 은 cron 15분 주기로 걸려 있지만, GitHub 의 schedule 이벤트는
 *   고부하 시 지연되고 유실된다. 즉 "15분마다 검사"는 설정값일 뿐이고 **실효 탐지 지연**은
 *   따로 재야 한다. 탐지 지연의 상한을 정하는 것은 평균 간격이 아니라 **최대 공백**이다.
 *
 * 무엇을 재는가
 *   워크플로의 schedule 발화 시각을 전부 받아서
 *     - 관측 구간(등록 시각 또는 --since 부터 지금까지)
 *     - 기대 발화 수(cron 슬롯 수) 대비 실제 발화 수 = 발화율
 *     - 연속 발화 사이의 간격 분포와 **최대 공백**(아직 닫히지 않은 현재 공백 포함)
 *     - 각 발화가 직전 cron 슬롯 대비 얼마나 늦었는지(지연)
 *
 * 쓰는 법
 *   node scripts/ops/measure-deadmans-schedule.mjs
 *   node scripts/ops/measure-deadmans-schedule.mjs --since 2026-09-27T01:00:00Z
 *   node scripts/ops/measure-deadmans-schedule.mjs --cron "7,22,37,52" --json
 *
 * 전제
 *   gh CLI 가 인증되어 있어야 한다. 장기 자격증명을 이 파일에 두지 않는다.
 */

import { execFileSync } from 'node:child_process';

const REPO = process.env.DMS_REPO ?? 'araeLaver/Ipjuhae';
const WORKFLOW = process.env.DMS_WORKFLOW ?? 'ops-deadmans-switch.yml';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const asJson = process.argv.includes('--json');

function gh(path) {
  // `--slurp` 이 필요한 이유: `--paginate` 만 쓰면 페이지별 JSON 객체가 구분자 없이 이어 붙어
  // 나와 JSON.parse 가 깨진다. `--slurp` 는 페이지들을 하나의 배열로 감싸 준다.
  const out = execFileSync('gh', ['api', path, '--paginate', '--slurp'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(out);
}

/** cron 의 분 필드만 해석한다. 이 워크플로는 시/일/월/요일이 전부 `*` 인 형태만 쓴다. */
function cronMinutes(expr) {
  const minuteField = expr.trim().split(/\s+/)[0];
  if (minuteField.startsWith('*/')) {
    const step = Number(minuteField.slice(2));
    return Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  }
  return minuteField.split(',').map(Number).sort((a, b) => a - b);
}

/** [from, to) 구간에 cron 이 발화해야 하는 시각을 모두 낸다. */
function expectedSlots(from, to, minutes) {
  const slots = [];
  const cursor = new Date(from);
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(0);
  while (cursor <= to) {
    for (const m of minutes) {
      const slot = new Date(cursor);
      slot.setUTCMinutes(m);
      if (slot >= from && slot <= to) slots.push(new Date(slot));
    }
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }
  return slots.sort((a, b) => a - b);
}

const fmtDur = (ms) => {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}시간 ${m}분` : m > 0 ? `${m}분 ${s}초` : `${s}초`;
};

const pages = gh(`repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=100`);
const runs = pages.flatMap((p) => p.workflow_runs ?? []);
const scheduled = runs
  .filter((r) => r.event === 'schedule')
  .map((r) => new Date(r.run_started_at ?? r.created_at))
  .sort((a, b) => a - b);

// 관측 시작점: --since 가 있으면 그것, 없으면 이 워크플로의 가장 오래된 run(= 등록 시점 하한).
const oldestRun = runs.length
  ? new Date(Math.min(...runs.map((r) => new Date(r.created_at).getTime())))
  : null;
const since = arg('since') ? new Date(arg('since')) : oldestRun;
const now = new Date();
if (!since) {
  console.error('run 기록이 없어 관측 구간을 정할 수 없습니다.');
  process.exit(1);
}

const cron = arg('cron', '7,22,37,52');
const minutes = cronMinutes(cron);
const fires = scheduled.filter((d) => d >= since);
const slots = expectedSlots(since, now, minutes);

// 간격: 관측 시작 → 첫 발화, 발화 사이, 마지막 발화 → 지금(아직 닫히지 않은 공백).
const marks = [since, ...fires];
const gaps = [];
for (let i = 1; i < marks.length; i += 1) {
  gaps.push({ from: marks[i - 1], to: marks[i], ms: marks[i] - marks[i - 1], open: false });
}
const openGap = { from: marks[marks.length - 1], to: now, ms: now - marks[marks.length - 1], open: true };
gaps.push(openGap);

const maxGap = gaps.reduce((a, b) => (b.ms > a.ms ? b : a));

// 지연: 각 발화가 직전 cron 슬롯보다 얼마나 늦었는가.
const delays = fires.map((f) => {
  const prior = slots.filter((s) => s <= f).pop();
  return prior ? f - prior : null;
}).filter((d) => d !== null);

const windowMs = now - since;
const result = {
  repo: REPO,
  workflow: WORKFLOW,
  cron,
  observedFrom: since.toISOString(),
  observedTo: now.toISOString(),
  observedDuration: fmtDur(windowMs),
  observedHours: +(windowMs / 3_600_000).toFixed(2),
  expectedFires: slots.length,
  actualFires: fires.length,
  fireRatePct: slots.length ? +((fires.length / slots.length) * 100).toFixed(1) : null,
  maxGap: fmtDur(maxGap.ms),
  maxGapMinutes: Math.round(maxGap.ms / 60000),
  maxGapIsStillOpen: maxGap.open,
  openGap: fmtDur(openGap.ms),
  medianDelayMinutes: delays.length
    ? Math.round(delays.sort((a, b) => a - b)[Math.floor(delays.length / 2)] / 60000)
    : null,
  maxDelayMinutes: delays.length ? Math.round(Math.max(...delays) / 60000) : null,
  fireTimes: fires.map((f) => f.toISOString()),
  gaps: gaps.map((g) => ({ from: g.from.toISOString(), to: g.to.toISOString(), minutes: Math.round(g.ms / 60000), open: g.open })),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`저장소        ${result.repo} / ${result.workflow}`);
  console.log(`cron          ${result.cron}  (분 슬롯: ${minutes.join(',')})`);
  console.log(`관측 구간     ${result.observedFrom} → ${result.observedTo}  (${result.observedDuration})`);
  console.log(`기대 발화     ${result.expectedFires}회`);
  console.log(`실제 발화     ${result.actualFires}회`);
  console.log(`발화율        ${result.fireRatePct}%`);
  console.log(`최대 공백     ${result.maxGap}${result.maxGapIsStillOpen ? ' (아직 닫히지 않음 — 더 커질 수 있다)' : ''}`);
  console.log(`현재 공백     ${result.openGap}`);
  console.log(`슬롯 대비 지연 중앙값 ${result.medianDelayMinutes}분 / 최대 ${result.maxDelayMinutes}분`);
  console.log('\n발화 시각');
  for (const t of result.fireTimes) console.log(`  ${t}`);
  console.log('\n공백 분포');
  for (const g of result.gaps) {
    console.log(`  ${g.minutes}분  ${g.from} → ${g.to}${g.open ? '  (열림)' : ''}`);
  }
}
