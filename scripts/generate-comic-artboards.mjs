#!/usr/bin/env node
/**
 * 연재 만화 「지수의 계약」 아트보드 생성기.
 *
 * 원고(`marketing/sns/posts/05-series-comic.md`)의 4컷 구성을 읽어
 * `marketing/sns/canvas/ComicNN.dc.html`을 만들고 canvas.json에 등록한다.
 * 형식은 #01(수작업본)을 기준으로 고정한다 — 매 화 형식이 달라지면
 * 연재로 인식되지 않는다.
 *
 *   node scripts/generate-comic-artboards.mjs [--from 2] [--to 12]
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const POSTS = path.resolve('marketing/sns/posts/05-series-comic.md')
const CANVAS_DIR = path.resolve('marketing/sns/canvas')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : Number(process.argv[i + 1])
}
const FROM = arg('--from', 2)
const TO = arg('--to', 12)

const C = {
  navy: '#0C2247',
  amber: '#E9A23B',
  cream: '#FBF6EF',
  bronze: '#B08D62',
  ink: '#262220',
}

// ── 원고 파싱 ────────────────────────────────────────────────
function parseEpisodes(src) {
  return src
    .split(/\n## #/)
    .slice(1)
    .map((block) => {
      const [, num, title] = block.match(/^(\d+) · (.+)$/m)
      const cuts = [...block.matchAll(/^\d\. \*\*(.+?)\*\* — (.+)$/gm)].map((m) => {
        // "지수 · 말 (앞집 사람은 등장 안 함)" 처럼 붙은 괄호 주석은 연출 메모라 버린다.
        const [who, mood] = m[1].replace(/\s*\(.*?\)\s*$/, '').split(' · ')
        return { who, mood, lines: m[2].split(' / ').map((s) => s.trim()) }
      })
      const next = block.match(/^다음 화 — (.+)$/m)?.[1] ?? null
      return { num, title, cuts, next }
    })
}

// ── 그리기 조각 ──────────────────────────────────────────────
/** 지수·김 소장의 얼굴. 형태와 치수는 매 화 동일하다. */
function face(who, mood) {
  const isJisu = who === '지수'
  const border = isJisu ? C.amber : C.bronze
  const shape = isJisu ? 'border-radius:50%' : 'border-radius:10px'

  const eyes = isJisu
    ? `<div style="display:flex;gap:18px"><div style="width:7px;height:7px;border-radius:50%;background:${C.ink}"></div><div style="width:7px;height:7px;border-radius:50%;background:${C.ink}"></div></div>`
    : `<div style="display:flex;gap:17px"><div style="width:13px;height:3px;background:${C.ink}"></div><div style="width:13px;height:3px;background:${C.ink}"></div></div>`

  // 입: 평범(가로 선) / 걱정(아래로 굽은 호) / 놀람(검은 원)
  let mouth = `<div style="width:17px;height:3px;background:${C.ink};margin-top:12px"></div>`
  if (isJisu && mood === '놀람') {
    mouth = `<div style="width:13px;height:13px;border-radius:50%;background:${C.ink};margin-top:8px"></div>`
  } else if (isJisu && mood === '걱정') {
    mouth = `<div style="width:19px;height:8px;border-top:3px solid ${C.ink};border-radius:50% 50% 0 0;margin-top:9px"></div>`
  }

  return `<div style="display:flex;justify-content:center"><div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:86px;height:86px;${shape};background:${C.cream};border:3px solid ${border};display:flex;flex-direction:column;align-items:center;justify-content:center">${eyes}${mouth}</div><div style="font-size:20px;font-weight:700;color:${C.ink}">${who}</div></div></div>`
}

/** 말풍선(흰색)과 생각풍선(크림 + 점선). */
function bubble(lines, mood, align) {
  const thought = mood === '생각' || mood === '걱정'
  const skin = thought
    ? `background:${C.cream};border:2px dashed ${C.bronze}`
    : 'background:#FFFFFF'
  return `<div style="display:flex;justify-content:${align}"><div style="${skin};color:${C.ink};border-radius:16px;padding:14px 18px;font-size:26px;font-weight:700;line-height:1.45;max-width:360px;white-space:pre-line">${lines.join('\n')}</div></div>`
}

/** 서류를 보여주는 컷 — 인물 없이 글자만. */
function paper(lines) {
  return `<div style="display:flex;justify-content:center"><div style="background:#FFFFFF;border:2px solid ${C.bronze};border-radius:12px;padding:30px 26px;display:flex;flex-direction:column;gap:10px;align-items:center;max-width:380px"><div style="font-size:34px;font-weight:900;line-height:1.45;color:${C.ink};text-align:center;white-space:pre-line">${lines.join('\n')}</div></div></div>`
}

/**
 * 컷 하나. 풍선과 얼굴의 순서를 1·4컷과 2·3컷이 다르게 가져가
 * 넘길 때 리듬이 생기게 한다 (#01과 동일).
 */
function panel(cut, index) {
  const n = index + 1
  const number = `<div style="position:absolute;top:14px;right:18px;font-size:20px;font-weight:700;color:${C.bronze}">${n}</div>`

  let body
  if (cut.who.startsWith('종이')) {
    body = paper(cut.lines)
  } else if (n === 1 || n === 4) {
    body = bubble(cut.lines, cut.mood, 'flex-start') + face(cut.who, cut.mood)
  } else {
    const align = n === 2 ? 'flex-end' : 'flex-start'
    body = face(cut.who, cut.mood) + bubble(cut.lines, cut.mood, align)
  }

  return `<div style="position:relative;background:${C.cream};border-radius:14px;padding:26px;display:flex;flex-direction:column;justify-content:center;gap:22px;overflow:hidden">${number}${body}</div>`
}

function artboard(ep) {
  // #11은 원고가 "마지막 화 — 도장"으로 예고한다. "다음 화 —"를 덧붙이지 않는다.
  const footer = ep.next
    ? ep.next.startsWith('마지막 화')
      ? ep.next
      : `다음 화 — ${ep.next}`
    : '연재 끝 — 다음 연재 「임대인 노트」'

  const header = `<div style="display:flex;align-items:baseline;justify-content:space-between"><div style="display:flex;align-items:baseline;gap:14px"><div style="font-size:30px;font-weight:700;color:${C.amber}">지수의 계약</div><div style="font-size:52px;font-weight:900;letter-spacing:-2px">#${ep.num}</div></div><div style="font-size:26px;color:rgba(255,255,255,0.6)">${ep.title}</div></div>`
  const grid = `<div style="flex-grow:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:18px">${ep.cuts.map(panel).join('')}</div>`
  const foot = `<div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:28px;font-weight:700;color:${C.amber}">${footer}</div><div style="font-size:24px;font-weight:700;color:rgba(255,255,255,0.55)">입주해</div></div>`

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;700;900&display=swap">
  <style>
    body { margin: 0; background: ${C.navy}; }
    a { color: ${C.amber}; }
    a:hover { color: #F5C173; }
  </style>
</helmet>
<div style="width:1080px;height:1350px;box-sizing:border-box;background:${C.navy};font-family:'Gothic A1', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;color:#FFFFFF;padding:70px 60px 60px;display:flex;flex-direction:column;gap:26px">${header}${grid}${foot}</div>
</x-dc>
<script data-dc-script data-props='{}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`
}

// ── 실행 ─────────────────────────────────────────────────────
const episodes = parseEpisodes(await readFile(POSTS, 'utf8')).filter(
  (e) => Number(e.num) >= FROM && Number(e.num) <= TO
)

const canvasPath = path.join(CANVAS_DIR, 'canvas.json')
const canvas = JSON.parse(await readFile(canvasPath, 'utf8'))
const first = canvas.artboards.find((a) => a.file === 'Comic01.dc.html')
const baseX = first?.x ?? 0
const baseY = first?.y ?? 0

for (const ep of episodes) {
  if (ep.cuts.length !== 4) throw new Error(`#${ep.num}: 4컷이 아닙니다 (${ep.cuts.length}컷)`)
  const file = `Comic${ep.num}.dc.html`
  await writeFile(path.join(CANVAS_DIR, file), artboard(ep))

  if (!canvas.artboards.some((a) => a.file === file)) {
    canvas.artboards.push({
      file,
      x: baseX + (Number(ep.num) - 1) * 1170,
      y: baseY,
      w: 1080,
      h: 1350,
      page: first?.page ?? 'page-2',
    })
  }
  console.log(`✓ ${file} — ${ep.title}`)
}

await writeFile(canvasPath, JSON.stringify(canvas, null, 2) + '\n')
console.log(`\n${episodes.length}화 생성. canvas.json 갱신 완료.`)
