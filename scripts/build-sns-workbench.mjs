#!/usr/bin/env node
/**
 * SNS 게시 워크벤치 — 원고에서 아티팩트 페이지를 만든다.
 *
 * `marketing/sns/posts/*.md`를 읽어 게시물별 이미지 프롬프트와 게시글을
 * 골라 복사하는 한 장짜리 페이지(`marketing/sns/workbench.html`)를 만든다.
 *
 * 단위는 **만들 이미지 하나**다 — 캐러셀 / 4컷 / 단장. 프롬프트 안의 장·컷을
 * 갈라 표로 펴고, 원문은 접어 둔다. 프롬프트가 40줄짜리 덩어리로 쌓이면
 * 뭘 만들어야 하는지가 안 보인다.
 *
 *   node scripts/build-sns-workbench.mjs
 *
 * 만든 뒤 아티팩트로 올리면 같은 URL이 갱신된다(README의 온라인 문서 표 참고).
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const POSTS = path.resolve('marketing/sns/posts')
const OUT = path.resolve('marketing/sns/workbench.html')

const SERIES = [
  { file: '01-series-deungi.md', name: '등기부 뜯어보기', track: '도달 · 세입자' },
  { file: '02-series-landlord.md', name: '임대인 노트', track: '전환 · 임대인·중개사' },
  { file: '05-series-comic.md', name: '지수의 계약', track: '도달 · 세입자' },
  { file: '06-series-reels.md', name: '계약 전 30초', track: '릴스 · 세입자' },
  { file: '03-log.md', name: '만드는 중', track: '일지 · 번호 없음', flat: true },
  { file: '04-solo.md', name: '단발 · 확산용', track: '번호 없음', flat: true },
]

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ── 원고 읽기 ────────────────────────────────────────────────
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
    if (h3) {
      section = h3[1].trim()
      label = null
      i++
      continue
    }
    const bold = l.match(/^\*\*(.+?)\*\*/)
    if (bold) {
      label = bold[1].trim()
      i++
      continue
    }
    if (l.startsWith('```')) {
      const buf = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++])
      i++
      if (label) out.push({ section, label, text: buf.join('\n').trim() })
      label = null
      continue
    }
    i++
  }
  return out
}

const WARN = /⚠︎\s*\*\*올리기 전 확인\*\*\s*—\s*(.+)/

function readEpisodes(src, flat) {
  if (flat) {
    // 일지와 단발은 회차 번호가 없다. ### 섹션 하나가 게시물 한 건.
    return src
      .split(/\n### /)
      .slice(1)
      .map((b, i) => {
        const body = '\n### ' + b
        const blocks = collectBlocks(body)
        return {
          num: String(i + 1).padStart(2, '0'),
          title: b.slice(0, b.indexOf('\n')).trim(),
          topic: null,
          warn: WARN.exec(b)?.[1]?.trim() ?? null,
          noImage: /\*\*디자인\*\* — (.+)/.exec(b)?.[1]?.trim() ?? null,
          copy: blocks.filter((x) => !/프롬프트/.test(x.label)),
          prompts: blocks.filter((x) => /프롬프트/.test(x.label)),
        }
      })
  }
  return src
    .split(/\n## #/)
    .slice(1)
    .map((b) => {
      const [, num, title] = b.match(/^(\d+) · (.+)$/m)
      const blocks = collectBlocks(b.slice(b.indexOf('\n')))
      const topic = b.match(/^\*\*이 화가 다루는 것:\*\* (.+)$/m)?.[1]?.trim() ?? null
      return {
        num,
        title,
        topic: topic && topic !== '—' ? topic : null,
        warn: WARN.exec(b)?.[1]?.trim() ?? null,
        noImage: null,
        copy: blocks.filter((x) => !/프롬프트/.test(x.label)),
        prompts: blocks.filter((x) => /프롬프트/.test(x.label)),
      }
    })
}

// ── 프롬프트를 장·컷으로 가르기 ──────────────────────────────
const SLIDE = /^\s*(\d+)\s*(장|컷)\s*(.*)$/

function slice(text) {
  const slides = []
  let cur = null
  for (const l of text.split('\n')) {
    const m = SLIDE.exec(l)
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 20) {
      cur = { no: m[1], label: m[3].trim(), lines: [] }
      slides.push(cur)
      continue
    }
    if (!cur) continue
    // 장 블록은 들여쓴 줄로 이어진다. 들여쓰기가 끊기면 블록도 끝난다.
    if (/^\s{2,}\S/.test(l)) cur.lines.push(l.trim())
    else if (l.trim() !== '') cur = null
  }
  // "2장  제목: 준비물"처럼 표시줄에 내용이 붙어 있으면 라벨이 아니라 내용이다.
  return slides.map((s) =>
    s.label && /^[가-힣A-Za-z][^:]{0,8}:/.test(s.label)
      ? { ...s, label: '', lines: [s.label, ...s.lines] }
      : s
  )
}

function spec(text, slides) {
  const carousel = /캐러셀\s*(\d+)\s*장/.exec(text)
  const size = /(\d[\d,]*)\s*[×x]\s*(\d[\d,]*)\s*px/.exec(text)
  let kind = carousel ? `캐러셀 ${carousel[1]}장` : /4컷/.test(text) ? '4컷' : '1장'
  if (kind === '1장' && slides.length > 1) kind = `캐러셀 ${slides.length}장`
  return { kind, size: size ? `${size[1]} × ${size[2]}` : null }
}

// ── 조각 ─────────────────────────────────────────────────────
/** "제목: 값"은 키를 흐리게 둬서 넣을 문구만 눈에 들어오게 한다. */
const slideLine = (l) => {
  const m = /^([가-힣A-Za-z][가-힣A-Za-z\s]{0,8}):\s*(.+)$/.exec(l)
  return m ? `<span class="k">${esc(m[1])}</span>${esc(m[2])}` : esc(l)
}

const slideTable = (slides) => `
  <ol class="slides">
    ${slides
      .map(
        (s) => `
      <li class="slide">
        <span class="slide-no">${esc(s.no)}</span>
        <div class="slide-body">
          ${s.label ? `<p class="slide-label">${esc(s.label.replace(/^\(|\)$/g, ''))}</p>` : ''}
          ${s.lines.map((l) => `<p class="slide-line">${slideLine(l)}</p>`).join('')}
        </div>
      </li>`
      )
      .join('')}
  </ol>`

const promptCard = (p) => `
  <article class="unit">
    <header class="unit-head">
      <div class="unit-id">
        <span class="kind ${p.kind === '1장' ? '' : 'kind-multi'}">${esc(p.kind)}</span>
        ${p.size ? `<span class="size">${esc(p.size)}</span>` : ''}
        <span class="unit-name">${esc(p.section || p.label)}</span>
      </div>
      <button class="copy" type="button" data-copy>프롬프트 복사</button>
    </header>
    ${p.slides.length ? slideTable(p.slides) : ''}
    ${
      p.slides.length
        ? `<details class="raw"><summary>프롬프트 원문</summary><pre class="block"><code>${esc(p.text)}</code></pre></details>`
        : `<pre class="block"><code>${esc(p.text)}</code></pre>`
    }
  </article>`

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
const data = []
for (const s of SERIES) {
  let src
  try {
    src = await readFile(path.join(POSTS, s.file), 'utf8')
  } catch {
    continue
  }
  const episodes = readEpisodes(src, s.flat)
  for (const e of episodes) {
    for (const p of e.prompts) {
      p.slides = slice(p.text)
      Object.assign(p, spec(p.text, p.slides))
    }
  }
  data.push({ ...s, episodes })
}

const units = data.flatMap((s) => s.episodes.flatMap((e) => e.prompts))
const nCarousel = units.filter((p) => p.kind.startsWith('캐러셀')).length
const nCut = units.filter((p) => p.kind === '4컷').length
const nSingle = units.length - nCarousel - nCut
const nPosts = data.reduce((a, s) => a + s.episodes.reduce((n, e) => n + e.copy.length, 0), 0)

const rail = data
  .map(
    (s, si) => `
  <section class="rail-group">
    <h2 class="rail-title">${esc(s.name)}</h2>
    <p class="rail-track">${esc(s.track)}</p>
    <ol class="rail-list">
      ${s.episodes
        .map(
          (e, ei) => `
        <li><button class="rail-item" data-go="${si}-${ei}" type="button">
          <span class="rail-num">${s.flat ? '·' : '#' + esc(e.num)}</span>
          <span class="rail-name">${esc(e.title)}</span>
          ${e.warn ? '<span class="rail-flag">확인</span>' : ''}
        </button></li>`
        )
        .join('')}
    </ol>
  </section>`
  )
  .join('')

const panes = data
  .map((s, si) =>
    s.episodes
      .map(
        (e, ei) => `
  <section class="pane" data-pane="${si}-${ei}" hidden>
    <header class="pane-head">
      <p class="eyebrow">${esc(s.name)}</p>
      <h1 class="pane-title">${s.flat ? '' : `<span class="pane-num">#${esc(e.num)}</span>`}${esc(e.title)}</h1>
      ${e.topic ? `<p class="topic">${esc(e.topic)}</p>` : ''}
      ${e.warn ? `<div class="warn"><span class="warn-tag">올리기 전 확인</span><p>${esc(e.warn)}</p></div>` : ''}
      ${e.noImage ? `<div class="noimg"><span class="noimg-tag">이미지 없음</span><p>${esc(e.noImage)}</p></div>` : ''}
    </header>
    ${e.prompts.length ? `<h3 class="group-head">이미지<span>Claude Design에 붙여넣기</span></h3>${e.prompts.map(promptCard).join('')}` : ''}
    ${e.copy.length ? `<h3 class="group-head">게시글<span>채널에 붙여넣기</span></h3>${e.copy.map(postCard).join('')}` : ''}
    <nav class="pager">
      <button class="page-btn" type="button" data-step="-1">← 이전</button>
      <button class="page-btn" type="button" data-step="1">다음 →</button>
    </nav>
  </section>`
      )
      .join('')
  )
  .join('')

const order = JSON.stringify(data.flatMap((s, si) => s.episodes.map((e, ei) => `${si}-${ei}`)))

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
.shell{display:grid;grid-template-columns:288px minmax(0,1fr);min-height:100vh}

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
.rail-item{display:flex;align-items:baseline;gap:9px;width:100%;text-align:left;background:none;border:0;
  padding:7px 10px;border-radius:7px;cursor:pointer;color:var(--rail-muted);font-size:13.5px;
  transition:background .12s,color .12s}
.rail-item:hover{background:rgba(255,255,255,.06);color:var(--rail-ink)}
.rail-item[aria-current="true"]{background:var(--amber);color:#17120A;font-weight:700}
.rail-num{font-family:var(--mono);font-size:11.5px;font-variant-numeric:tabular-nums;opacity:.8}
.rail-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rail-flag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:rgba(232,144,118,.18);color:#F0A88E}
.rail-item[aria-current="true"] .rail-flag{background:rgba(23,18,10,.18);color:#17120A}

.main{padding:46px 48px 90px;max-width:900px}
.pane[hidden]{display:none}
.eyebrow{font-size:12.5px;font-weight:700;letter-spacing:.14em;color:var(--amber);margin:0 0 8px}
.pane-title{font-size:clamp(26px,3.2vw,36px);font-weight:900;letter-spacing:-.03em;margin:0;line-height:1.2;
  text-wrap:balance;display:flex;gap:13px;align-items:baseline;flex-wrap:wrap}
.pane-num{font-family:var(--mono);font-weight:600;font-size:.6em;color:var(--faint);font-variant-numeric:tabular-nums}
.topic{margin:10px 0 0;font-size:14px;color:var(--muted)}
.warn,.noimg{display:flex;gap:12px;align-items:flex-start;margin-top:16px;padding:12px 15px;border-radius:10px}
.warn{background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 32%,transparent)}
.noimg{background:var(--surface);border:1px dashed var(--line)}
.warn-tag{flex:none;font-size:11.5px;font-weight:900;color:var(--warn);padding-top:2px}
.noimg-tag{flex:none;font-size:11.5px;font-weight:900;color:var(--muted);padding-top:2px}
.warn p,.noimg p{margin:0;font-size:13.5px;line-height:1.55}
.noimg p{color:var(--muted)}

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
.slide-label{margin:0;font-size:12px;color:var(--faint);letter-spacing:.02em}
.slide-line{margin:0;font-size:14.5px;line-height:1.6;word-break:break-word}
.slide-line .k{color:var(--faint);font-size:12.5px;margin-right:7px}

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
      <p class="brand-note">프롬프트를 복사해 Claude Design에 붙여넣고, 나온 이미지에 게시글을 함께 올린다.</p>
      <ul class="stats">
        <li>캐러셀 <b>${nCarousel}</b></li><li>4컷 <b>${nCut}</b></li>
        <li>단장 <b>${nSingle}</b></li><li>게시글 <b>${nPosts}</b></li>
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
console.log(
  `캐러셀 ${nCarousel} · 4컷 ${nCut} · 단장 ${nSingle} · 게시글 ${nPosts} → ${path.relative(process.cwd(), OUT)}`
)
