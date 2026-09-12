#!/usr/bin/env node
/**
 * 연재 「지수의 계약」 아트보드 생성기.
 *
 * 원고(`marketing/sns/posts/05-series-comic.md`)의 4컷 구성을 읽어
 * `marketing/sns/canvas/ComicNN.dc.html`을 만들고 canvas.json에 등록한다.
 *
 * 시각 언어는 **대화 기록 + 서류**다. 인물을 그리지 않는다 —
 * HTML/CSS로 사람 얼굴을 그리면 와이어프레임처럼 보인다. 대신 타이포그래피와
 * 문서 레이아웃으로 간다. 이야기는 말풍선과 내레이션이 끌고 간다.
 *
 * 매 화가 공유하는 것(연계성): 머리말 · 카드 프레임 · 주제 칩 · 말풍선 규칙 ·
 * 내레이션 규칙 · 서류 카드 규칙 · 꼬리말. 이 형식을 화마다 바꾸지 않는다.
 *
 *   node scripts/generate-comic-artboards.mjs [--from 1] [--to 12]
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const POSTS = path.resolve('marketing/sns/posts/05-series-comic.md')
const CANVAS_DIR = path.resolve('marketing/sns/canvas')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : Number(process.argv[i + 1])
}
const FROM = arg('--from', 1)
const TO = arg('--to', 12)

const C = {
  navy: '#0C2247',
  amber: '#E9A23B',
  bronze: '#B08D62',
  ink: '#1B1A18',
  paper: '#EEF1F5',
  grey: '#8A93A0',
}
const FONT = "'Gothic A1','Apple SD Gothic Neo','Malgun Gothic',sans-serif"

/**
 * 서류 컷의 내용. 원고는 "소유자 / ○○부동산신탁"처럼 핵심 문구만 주기 때문에,
 * 실제 등기부·계약서의 어느 칸에서 나온 값인지는 여기서 채운다.
 * 강조(true)한 행이 그 화의 결정적 한 줄이다.
 */
const DOCS = {
  '02': {
    label: '등기사항전부증명서',
    section: '【갑구】 소유권에 관한 사항',
    rows: [
      ['등기목적', '소유권이전'],
      ['소유자', '○○부동산신탁 주식회사', true],
      ['등기원인', '신탁'],
    ],
    note: '계약하려던 상대는 박○○ 씨였다',
  },
  '04': {
    label: '등기사항전부증명서',
    section: '【을구】 소유권 이외의 권리에 관한 사항',
    rows: [
      ['등기목적', '근저당권설정'],
      ['채권최고액', '금 240,000,000원', true],
      ['근저당권자', '○○은행'],
    ],
    note: '이 집의 시세는 3억이라고 들었다',
  },
  '06': {
    label: '전세보증금 반환보증 심사 결과',
    section: '신청 결과',
    rows: [
      ['결과', '가입 불가', true],
      ['안내', '심사 기준을 충족하지 않음'],
    ],
    note: '기준은 기관과 시기에 따라 다르다',
  },
  '07': {
    label: '등기사항전부증명서',
    section: '【갑구】 · 【을구】',
    rows: [
      ['소유자', '박○○'],
      ['근저당권', '기록사항 없음', true],
      ['신탁 표시', '없음'],
    ],
    note: '계약하려는 사람과 이름이 같다',
  },
  '10': {
    label: '등기사항전부증명서',
    section: '【을구】 소유권 이외의 권리에 관한 사항',
    rows: [
      ['등기목적', '근저당권설정', true],
      ['접수', '잔금일 당일'],
      ['근저당권자', '○○은행'],
    ],
    note: '어제까지는 없던 줄이다',
  },
  '11': {
    label: '주택임대차계약서',
    section: '특약사항',
    rows: [
      ['제1항', '현 시설 상태에서 임대차한다'],
      ['제3항', '잔금 다음 날까지 근저당 설정 금지', true],
    ],
    note: '계약할 때 넣어달라고 했던 한 줄',
  },
}

// ── 원고 파싱 ────────────────────────────────────────────────
function parseEpisodes(src) {
  return src
    .split(/\n## #/)
    .slice(1)
    .map((block) => {
      const [, num, title] = block.match(/^(\d+) · (.+)$/m)
      const topicRaw = block.match(/^\*\*이 화가 다루는 것:\*\* (.+)$/m)?.[1]?.trim()
      const cuts = [...block.matchAll(/^\d\. \*\*(.+?)\*\* — (.+)$/gm)].map((m) => {
        // "지수 · 말 (앞집 사람은 등장 안 함)"의 괄호는 연출 메모라 버린다.
        const [who, mood] = m[1].replace(/\s*\(.*?\)\s*$/, '').split(' · ')
        return { who, mood, lines: m[2].split(' / ').map((s) => s.trim()) }
      })
      return {
        num,
        title,
        topic: topicRaw && topicRaw !== '—' ? topicRaw : null,
        cuts,
        next: block.match(/^다음 화 — (.+)$/m)?.[1] ?? null,
      }
    })
}

// ── 그리기 조각 ──────────────────────────────────────────────
/** 상대(김 소장)의 말 — 왼쪽, 흰 말풍선, 이름표. */
const them = (name, lines) => `<div style="display:flex;gap:16px;align-items:flex-start"><div style="flex:none;width:64px;height:64px;border-radius:18px;background:${C.bronze};color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900">${name[0]}</div><div><div style="font-size:22px;font-weight:700;color:${C.grey};margin:0 0 10px 4px">${name}</div><div style="background:#FFFFFF;color:${C.ink};border-radius:4px 20px 20px 20px;padding:22px 26px;font-size:34px;font-weight:700;line-height:1.5;white-space:pre-line;max-width:620px;box-shadow:0 2px 10px rgba(12,34,71,0.07)">${lines.join('\n')}</div></div></div>`

/** 지수의 말 — 오른쪽, 앰버. */
const me = (lines) => `<div style="display:flex;justify-content:flex-end"><div style="background:${C.amber};color:${C.ink};border-radius:20px 4px 20px 20px;padding:22px 26px;font-size:34px;font-weight:700;line-height:1.5;white-space:pre-line;max-width:620px">${lines.join('\n')}</div></div>`

/** 지수의 속마음 — 대화 사이에 끼는 내레이션. */
const inner = (lines) => `<div style="display:flex;justify-content:center;padding:4px 0"><div style="color:${C.navy};font-size:30px;font-weight:700;line-height:1.5;text-align:center;white-space:pre-line;opacity:0.62;border-top:2px dashed rgba(12,34,71,0.22);border-bottom:2px dashed rgba(12,34,71,0.22);padding:16px 8px">${lines.join('\n')}</div></div>`

/** 등기부·계약서 서류 카드. 실제 서류로 오인되지 않게 「예시」를 항상 붙인다. */
function paper(spec, fallbackLines) {
  const doc = spec ?? {
    label: '서류',
    section: '',
    rows: fallbackLines.map((l, i) => ['', l, i === fallbackLines.length - 1]),
    note: null,
  }
  const rows = doc.rows
    .map(
      ([k, v, mark], i) =>
        `<div style="display:flex;gap:20px;align-items:baseline;padding:14px 0;${i ? 'border-top:1px solid rgba(12,34,71,0.10)' : ''}"><div style="flex:none;width:200px;font-size:25px;font-weight:700;color:${C.grey}">${k}</div><div style="font-size:${mark ? 36 : 29}px;font-weight:${mark ? 900 : 700};color:${C.ink};line-height:1.4;${mark ? `background:linear-gradient(transparent 62%, ${C.amber}66 62%);display:inline;box-decoration-break:clone;-webkit-box-decoration-break:clone` : ''}">${v}</div></div>`
    )
    .join('')

  return `<div style="background:#FFFFFF;border:2px solid rgba(12,34,71,0.16);border-radius:14px;overflow:hidden"><div style="display:flex;align-items:center;justify-content:space-between;padding:18px 26px;border-bottom:2px solid rgba(12,34,71,0.10);background:#F7F9FB"><div style="font-size:24px;font-weight:900;color:${C.navy};letter-spacing:-0.5px">${doc.label}</div><div style="font-size:19px;font-weight:700;color:${C.grey};border:1px solid ${C.grey};border-radius:999px;padding:3px 12px">예시</div></div><div style="padding:24px 26px">${doc.section ? `<div style="font-size:23px;font-weight:900;color:${C.navy};margin-bottom:16px">${doc.section}</div>` : ''}${rows}</div>${doc.note ? `<div style="padding:0 26px 22px;font-size:24px;font-weight:700;color:${C.bronze}">${doc.note}</div>` : ''}</div>`
}

/** 컷 하나를 블록으로. 생각·걱정은 내레이션, 나머지 발화는 말풍선. */
function block(cut, ep) {
  if (cut.who.startsWith('종이')) return paper(DOCS[ep.num], cut.lines)
  if (cut.who === '지수') {
    return cut.mood === '생각' || cut.mood === '걱정' ? inner(cut.lines) : me(cut.lines)
  }
  return them(cut.who, cut.lines)
}

function artboard(ep) {
  // #11은 원고가 "마지막 화 — 도장"으로 예고한다. "다음 화 —"를 덧붙이지 않는다.
  const footer = ep.next
    ? ep.next.startsWith('마지막 화')
      ? ep.next
      : `다음 화 — ${ep.next}`
    : '연재 끝 — 다음 연재 「임대인 노트」'

  const chip = ep.topic
    ? `<div style="display:flex;justify-content:center"><div style="font-size:23px;font-weight:700;color:${C.navy};opacity:0.55;border:2px solid rgba(12,34,71,0.18);border-radius:999px;padding:8px 22px">${ep.topic}</div></div>`
    : ''

  const header = `<div style="display:flex;align-items:baseline;justify-content:space-between"><div style="display:flex;align-items:baseline;gap:14px"><div style="font-size:30px;font-weight:700;color:${C.amber}">지수의 계약</div><div style="font-size:52px;font-weight:900;letter-spacing:-2px;color:#FFFFFF">#${ep.num}</div></div><div style="font-size:26px;font-weight:700;color:rgba(255,255,255,0.6)">${ep.title}</div></div>`
  // 서류 카드가 없는 화는 내용이 적어 가운데 정렬하면 위아래가 휑하다. 고르게 편다.
  const spread = ep.cuts.some((c) => c.who.startsWith('종이')) ? 'center' : 'space-evenly'
  const card = `<div style="flex-grow:1;background:${C.paper};border-radius:26px;padding:34px;display:flex;flex-direction:column;justify-content:${spread};gap:${ep.topic ? 24 : 30}px">${chip}${ep.cuts.map((c) => block(c, ep)).join('')}</div>`
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
<div style="width:1080px;height:1350px;box-sizing:border-box;background:${C.navy};font-family:${FONT};color:#FFFFFF;padding:60px 54px 54px;display:flex;flex-direction:column;gap:26px">${header}${card}${foot}</div>
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
