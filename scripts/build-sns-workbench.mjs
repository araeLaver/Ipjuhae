#!/usr/bin/env node
/**
 * SNS 게시 워크벤치 — 연속 이미지 세트와 게시글을 골라 복사하는 한 장짜리 페이지.
 *
 * 게시물 하나 = **이어지는 이미지 세트 한 벌 + 게시글**. 한 장짜리 이미지는 다루지 않는다.
 * 이미지 세트는 `marketing/sns/carousels.mjs`와 만화 원고에서 오고(30세트 168장),
 * 게시글은 `marketing/sns/posts/*.md`의 캡션에서 온다.
 *
 *   node scripts/build-sns-workbench.mjs   # → marketing/sns/workbench.html
 *
 * 만든 뒤 기존 아티팩트 URL과 함께 올려야 같은 링크가 갱신된다(README 참고).
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { collect } from './build-carousel-prompts.mjs'

const POSTS = path.resolve('marketing/sns/posts')
const OUT = path.resolve('marketing/sns/workbench.html')

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ── 게시글 캡션 읽기 ─────────────────────────────────────────
/** 한 화 안에서 (섹션, 라벨, 코드블록) 묶음을 순서대로 뽑는다. */
function collectBlocks(body) {
  const lines = body.split('\n')
  const out = []
  let section = null
  let label = null
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    const h3 = l.match(/^### (.+)$/)
    if (h3) { section = h3[1].trim(); label = null; i++; continue }
    const bold = l.match(/^\*\*(.+?)\*\*/)
    if (bold) { label = bold[1].trim(); i++; continue }
    if (l.startsWith('```')) {
      const buf = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++])
      i++
      if (label && !/프롬프트/.test(label)) out.push({ section, label, text: buf.join('\n').trim() })
      label = null
      continue
    }
    i++
  }
  return out
}

const WARN = /⚠︎\s*\*\*올리기 전 확인\*\*\s*—\s*(.+)/

async function readSource(file) {
  const src = await readFile(path.join(POSTS, file), 'utf8')
  const map = new Map()
  for (const b of src.split(/\n## #/).slice(1)) {
    const num = b.match(/^(\d+) · /m)[1]
    map.set(num, { posts: collectBlocks(b), warn: WARN.exec(b)?.[1]?.trim() ?? null })
  }
  return map
}

// ── 조각 ─────────────────────────────────────────────────────
const KIND_LABEL = {
  cover: '표지', point: '논점', plain: '본문', list: '목록',
  say: '대사', doc: '서류', end: '마지막',
}

function slideBody(s) {
  const rows = []
  if (s.kind === 'cover') {
    rows.push(['제목', s.title], ['설명', s.sub])
  } else if (s.kind === 'point') {
    rows.push(['라벨', s.label], ['제목', s.title])
    if (s.desc) rows.push(['설명', s.desc])
  } else if (s.kind === 'list') {
    rows.push(['제목', s.title], ['목록', s.items.map((t) => `· ${t}`).join('\n')])
  } else if (s.kind === 'say') {
    rows.push([`${s.who} · ${s.mood}`, s.title])
  } else if (s.kind === 'doc') {
    rows.push(['문구', s.title])
  } else {
    rows.push(['제목', s.title], ['설명', s.desc])
  }
  return rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<p class="slide-line"><span class="k">${esc(k)}</span><span class="v">${esc(v).replace(/\n/g, '<br>')}</span></p>`)
    .join('')
}

const slideTable = (slides) => `
  <ol class="slides">
    ${slides.map((s, i) => `
      <li class="slide">
        <span class="slide-no">${i + 1}</span>
        <div class="slide-body">
          <p class="slide-kind">${esc(KIND_LABEL[s.kind] ?? '')}</p>
          ${slideBody(s)}
        </div>
      </li>`).join('')}
  </ol>`

const postCard = (b) => `
  <article class="unit">
    <header class="unit-head">
      <div class="unit-id">
        <span class="kind kind-text">게시글</span>
        <span class="unit-name">${esc(b.section || b.label)}</span>
      </div>
      <button class="copy" type="button" data-copy>본문 복사</button>
    </header>
    <pre class="block block--sans"><code>${esc(b.text)}</code></pre>
  </article>`

// ── 조립 ─────────────────────────────────────────────────────
const sets = await collect()
const sources = new Map()
for (const file of new Set(sets.map((s) => s.source))) sources.set(file, await readSource(file))

for (const s of sets) {
  const extra = sources.get(s.source).get(s.num)
  s.posts = extra?.posts ?? []
  s.warn = extra?.warn ?? null
}

const groups = []
for (const s of sets) {
  let g = groups.find((x) => x.name === s.series)
  if (!g) groups.push((g = { name: s.series, track: s.track, items: [] }))
  g.items.push(s)
}

const nSets = sets.length
const nSlides = sets.reduce((a, s) => a + s.count, 0)
const nPosts = sets.reduce((a, s) => a + s.posts.length, 0)
const nWarn = sets.filter((s) => s.warn).length

const rail = groups.map((g, gi) => `
  <section class="rail-group">
    <h2 class="rail-title">${esc(g.name)}</h2>
    <p class="rail-track">${esc(g.track)}</p>
    <ol class="rail-list">
      ${g.items.map((s, ii) => `
        <li><button class="rail-item" data-go="${gi}-${ii}" type="button">
          <span class="rail-num">#${esc(s.num)}</span>
          <span class="rail-name">${esc(s.title)}</span>
          <span class="rail-count">${s.count}장</span>
          ${s.warn ? '<span class="rail-flag">확인</span>' : ''}
        </button></li>`).join('')}
    </ol>
  </section>`).join('')

const panes = groups.map((g, gi) => g.items.map((s, ii) => `
  <section class="pane" data-pane="${gi}-${ii}" hidden>
    <header class="pane-head">
      <p class="eyebrow">${esc(g.name)}</p>
      <h1 class="pane-title"><span class="pane-num">#${esc(s.num)}</span>${esc(s.title)}</h1>
      ${s.warn ? `<div class="warn"><span class="warn-tag">올리기 전 확인</span><p>${esc(s.warn)}</p></div>` : ''}
    </header>

    <h3 class="group-head">이미지 세트<span>Claude Design에 붙여넣기</span></h3>
    <article class="unit">
      <header class="unit-head">
        <div class="unit-id">
          <span class="kind kind-multi">캐러셀 ${s.count}장</span>
          <span class="size">1080 × 1350</span>
          <span class="unit-name">${s.next ? `다음 화 — ${esc(s.next)}` : '연재 마지막 화'}</span>
        </div>
        <button class="copy" type="button" data-copy>프롬프트 복사</button>
      </header>
      ${slideTable(s.slides)}
      <details class="raw"><summary>프롬프트 원문</summary><pre class="block"><code>${esc(s.prompt)}</code></pre></details>
    </article>

    ${s.posts.length ? `<h3 class="group-head">게시글<span>채널에 붙여넣기</span></h3>${s.posts.map(postCard).join('')}` : ''}

    <nav class="pager">
      <button class="page-btn" type="button" data-step="-1">← 이전</button>
      <button class="page-btn" type="button" data-step="1">다음 →</button>
    </nav>
  </section>`).join('')).join('')

const order = JSON.stringify(groups.flatMap((g, gi) => g.items.map((s, ii) => `${gi}-${ii}`)))

const html = `<title>입주해 게시 워크벤치</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;700;900&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
:root{
  --navy:#0C2247; --amber:#E9A23B;
  --ground:#F2F4F7; --surface:#FFFFFF; --sunken:#E9ECF2;
  --ink:#101B31; --muted:#66718A; --faint:#939DB2; --line:rgba(12,34,71,.13);
  --warn:#A8381F; --warn-bg:rgba(168,56,31,.09);
  --rail:#0C2247; --rail-ink:#EAEEF6; --rail-muted:#8FA0BE;
  --sans:'Gothic A1','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;
  --mono:'IBM Plex Mono','Gothic A1','Apple SD Gothic Neo',ui-monospace,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#080E1C; --surface:#0F192C; --sunken:#0A1223;
  --ink:#E7ECF4; --muted:#8E9BB4; --faint:#6D7B95; --line:rgba(255,255,255,.13);
  --warn:#E89076; --warn-bg:rgba(232,144,118,.11);
  --rail:#060B16; --rail-ink:#E7ECF4; --rail-muted:#7D8CA8;
}}
:root[data-theme="dark"]{
  --ground:#080E1C; --surface:#0F192C; --sunken:#0A1223;
  --ink:#E7ECF4; --muted:#8E9BB4; --faint:#6D7B95; --line:rgba(255,255,255,.13);
  --warn:#E89076; --warn-bg:rgba(232,144,118,.11);
  --rail:#060B16; --rail-ink:#E7ECF4; --rail-muted:#7D8CA8;
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--sans);
     -webkit-font-smoothing:antialiased;line-height:1.6}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--amber);outline-offset:2px;border-radius:4px}
.shell{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:100vh}

.rail{background:var(--rail);color:var(--rail-ink);padding:26px 0 40px;position:sticky;top:0;height:100vh;overflow-y:auto}
.brand{padding:0 24px 20px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:18px}
.brand-mark{font-size:13px;font-weight:700;letter-spacing:.16em;color:var(--amber);margin:0}
.brand-name{font-size:23px;font-weight:900;letter-spacing:-.02em;margin:6px 0 10px}
.brand-note{font-size:13px;color:var(--rail-muted);margin:0;line-height:1.5}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin:14px 0 0;padding:0;list-style:none;
  font-family:var(--mono);font-size:11.5px;color:var(--rail-muted);font-variant-numeric:tabular-nums}
.stats b{color:var(--rail-ink);font-weight:600}
.rail-group{padding:0 14px;margin-bottom:22px}
.rail-title{font-size:14px;font-weight:900;margin:0 0 2px;padding:0 10px}
.rail-track{font-size:11.5px;color:var(--rail-muted);margin:0 0 8px;padding:0 10px}
.rail-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.rail-item{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;background:none;border:0;
  padding:7px 10px;border-radius:7px;cursor:pointer;color:var(--rail-muted);font-size:13.5px;
  transition:background .12s,color .12s}
.rail-item:hover{background:rgba(255,255,255,.06);color:var(--rail-ink)}
.rail-item[aria-current="true"]{background:var(--amber);color:#17120A;font-weight:700}
.rail-num{font-family:var(--mono);font-size:11.5px;font-variant-numeric:tabular-nums;opacity:.8}
.rail-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rail-count{font-family:var(--mono);font-size:11px;opacity:.7;font-variant-numeric:tabular-nums}
.rail-flag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:rgba(232,144,118,.18);color:#F0A88E}
.rail-item[aria-current="true"] .rail-flag{background:rgba(23,18,10,.18);color:#17120A}

.main{padding:46px 48px 90px;max-width:900px}
.pane[hidden]{display:none}
.eyebrow{font-size:12.5px;font-weight:700;letter-spacing:.14em;color:var(--amber);margin:0 0 8px}
.pane-title{font-size:clamp(26px,3.2vw,36px);font-weight:900;letter-spacing:-.03em;margin:0;line-height:1.2;
  text-wrap:balance;display:flex;gap:13px;align-items:baseline;flex-wrap:wrap}
.pane-num{font-family:var(--mono);font-weight:600;font-size:.6em;color:var(--faint);font-variant-numeric:tabular-nums}
.warn{display:flex;gap:12px;align-items:flex-start;margin-top:16px;padding:12px 15px;border-radius:10px;
  background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 32%,transparent)}
.warn-tag{flex:none;font-size:11.5px;font-weight:900;color:var(--warn);padding-top:2px}
.warn p{margin:0;font-size:13.5px;line-height:1.55}

.group-head{display:flex;align-items:baseline;gap:10px;font-size:15px;font-weight:900;color:var(--ink);
  margin:40px 0 12px;padding-bottom:9px;border-bottom:1px solid var(--line)}
.group-head span{font-size:12px;font-weight:400;color:var(--faint)}

.unit{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:12px}
.unit-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 14px;
  border-bottom:1px solid var(--line);background:var(--sunken)}
.unit-id{display:flex;align-items:center;gap:9px;flex-wrap:wrap;min-width:0}
.kind{font-family:var(--mono);font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:6px;
  background:var(--navy);color:#EAEEF6;white-space:nowrap}
.kind-multi{background:var(--amber);color:#17120A}
.kind-text{background:transparent;color:var(--muted);border:1px solid var(--line)}
.size{font-family:var(--mono);font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums}
.unit-name{font-size:13px;font-weight:700;color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy{flex:none;border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:5px 14px;
  font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .12s,color .12s}
.copy:hover{background:var(--navy);color:#EAEEF6;border-color:transparent}
.copy[data-state="done"]{background:var(--amber);color:#17120A;border-color:transparent}

.slides{list-style:none;margin:0;padding:0}
.slide{display:flex;gap:16px;padding:13px 16px;border-bottom:1px solid var(--line)}
.slide:last-child{border-bottom:0}
.slide-no{flex:none;width:26px;height:26px;border-radius:7px;background:var(--sunken);color:var(--muted);
  font-family:var(--mono);font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;
  font-variant-numeric:tabular-nums}
.slide-body{min-width:0;display:flex;flex-direction:column;gap:3px}
.slide-kind{margin:0 0 1px;font-size:11px;color:var(--faint);letter-spacing:.08em}
.slide-line{margin:0;display:flex;gap:9px;font-size:14.5px;line-height:1.6}
.slide-line .k{flex:none;min-width:48px;white-space:nowrap;color:var(--faint);font-size:12.5px;padding-top:2px}
.slide-line .v{min-width:0;word-break:break-word}

.raw{border-top:1px solid var(--line)}
.raw summary{cursor:pointer;padding:10px 16px;font-size:12.5px;font-weight:700;color:var(--muted);list-style:none}
.raw summary::-webkit-details-marker{display:none}
.raw summary::before{content:"▸ ";color:var(--faint)}
.raw[open] summary::before{content:"▾ "}
.raw .block{border-top:1px solid var(--line)}
.block{margin:0;padding:16px 18px;overflow-x:auto;max-height:440px;overflow-y:auto;font-family:var(--mono);
  font-size:13px;line-height:1.72;white-space:pre-wrap;word-break:break-word;color:var(--ink)}
.block--sans{font-family:var(--sans);font-size:14.5px;line-height:1.8}

.pager{display:flex;gap:10px;margin-top:40px}
.page-btn{border:1px solid var(--line);background:var(--surface);border-radius:8px;padding:9px 18px;
  font-size:13.5px;font-weight:700;cursor:pointer}
.page-btn:hover{background:var(--navy);color:#EAEEF6;border-color:transparent}
.page-btn[disabled]{opacity:.35;cursor:default}
.page-btn[disabled]:hover{background:var(--surface);color:var(--ink);border-color:var(--line)}

@media (max-width:900px){
  .shell{grid-template-columns:1fr}
  .rail{position:static;height:auto;padding-bottom:22px}
  .rail-list{flex-direction:row;overflow-x:auto;gap:6px;padding-bottom:4px}
  .rail-item{width:auto;white-space:nowrap}
  .rail-name{max-width:150px}
  .main{padding:30px 20px 70px}
  .unit-head{flex-wrap:wrap}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="shell">
  <aside class="rail">
    <div class="brand">
      <p class="brand-mark">입주해</p>
      <p class="brand-name">게시 워크벤치</p>
      <p class="brand-note">게시물 하나 = 이어지는 이미지 한 벌 + 게시글. 한 장짜리는 넘길 이유가 없어 쓰지 않는다.</p>
      <ul class="stats">
        <li>세트 <b>${nSets}</b></li><li>이미지 <b>${nSlides}</b>장</li>
        <li>게시글 <b>${nPosts}</b></li><li>확인 필요 <b>${nWarn}</b></li>
      </ul>
    </div>
    ${rail}
  </aside>
  <main class="main">${panes}</main>
</div>

<script>
const ORDER = ${order};
const rail = document.querySelectorAll('.rail-item');
const panes = document.querySelectorAll('.pane');

function show(key, scroll) {
  panes.forEach(p => { p.hidden = p.dataset.pane !== key });
  rail.forEach(b => b.setAttribute('aria-current', String(b.dataset.go === key)));
  const i = ORDER.indexOf(key);
  const pane = document.querySelector('[data-pane="' + key + '"]');
  if (pane) pane.querySelectorAll('[data-step]').forEach(b => {
    const t = i + Number(b.dataset.step);
    b.disabled = t < 0 || t >= ORDER.length;
  });
  const active = document.querySelector('.rail-item[aria-current="true"]');
  if (active) active.scrollIntoView({ block: 'nearest' });
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
  history.replaceState(null, '', '#' + key);
}
rail.forEach(b => b.addEventListener('click', () => show(b.dataset.go, true)));

document.addEventListener('click', (ev) => {
  const step = ev.target.closest('[data-step]');
  if (step) {
    const cur = ORDER.indexOf(document.querySelector('.pane:not([hidden])').dataset.pane);
    const next = ORDER[cur + Number(step.dataset.step)];
    if (next) show(next, true);
    return;
  }
  const btn = ev.target.closest('[data-copy]');
  if (!btn) return;
  const code = btn.closest('.unit').querySelector('code');
  const label = btn.textContent;
  const done = () => {
    btn.textContent = '복사됨';
    btn.dataset.state = 'done';
    setTimeout(() => { btn.textContent = label; delete btn.dataset.state }, 1600);
  };
  // 샌드박스에서 클립보드가 막히면 블록을 선택해 두어 직접 복사하게 한다.
  const fallback = () => {
    const r = document.createRange();
    r.selectNodeContents(code);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    let ok = false;
    try { ok = document.execCommand('copy') } catch (e) {}
    if (ok) { sel.removeAllRanges(); done() }
    else { btn.textContent = '⌘C 로 복사'; setTimeout(() => { btn.textContent = label }, 2600) }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code.textContent).then(done, fallback);
  } else fallback();
});

show(ORDER.includes(location.hash.slice(1)) ? location.hash.slice(1) : ORDER[0], false);
</script>`

await writeFile(OUT, html)
console.log(`세트 ${nSets} · 이미지 ${nSlides}장 · 게시글 ${nPosts} → ${path.relative(process.cwd(), OUT)}`)
