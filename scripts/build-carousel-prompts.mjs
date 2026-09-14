#!/usr/bin/env node
/**
 * 연속 이미지 세트의 Claude Design 프롬프트를 만든다.
 *
 * 자료원은 두 곳이다.
 *   marketing/sns/carousels.mjs   등기부 뜯어보기 12 · 임대인 노트 6 — 손으로 짠 세트
 *   marketing/sns/posts/05-series-comic.md  지수의 계약 12 — 원고의 4컷을 그대로 장으로 편다
 *
 * 한 장짜리 이미지는 만들지 않는다. 넘길 이유가 없으면 저장도 팔로우도 안 붙는다.
 * 프롬프트는 세트마다 혼자서 완결된다 — 다른 곳을 같이 볼 필요가 없어야 붙여넣고 끝난다.
 *
 *   node scripts/build-carousel-prompts.mjs        # 프롬프트 텍스트를 만들어 JSON으로
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { SERIES, COVER_NOTE } from '../marketing/sns/carousels.mjs'

const POSTS = path.resolve('marketing/sns/posts')

// ── 만화 12화를 세트로 ───────────────────────────────────────
function comicSets(src) {
  return src
    .split(/\n## #/)
    .slice(1)
    .map((b) => {
      const [, num, title] = b.match(/^(\d+) · (.+)$/m)
      const cuts = [...b.matchAll(/^\d\. \*\*(.+?)\*\* — (.+)$/gm)].map((m) => {
        const [who, mood] = m[1].replace(/\s*\(.*?\)\s*$/, '').split(' · ')
        return { who, mood, lines: m[2].split(' / ').map((s) => s.trim()) }
      })
      const next = b.match(/^다음 화 — (.+)$/m)?.[1] ?? null
      const slides = cuts.map((c) =>
        c.who.startsWith('종이')
          ? { kind: 'doc', title: c.lines.join('\n') }
          : { kind: 'say', who: c.who, mood: c.mood, title: c.lines.join('\n') }
      )
      slides.push({ kind: 'end', title: next ? '다음 화' : '연재 끝', desc: next ?? '다음 연재 「임대인 노트」' })
      return { num, title, next, slides }
    })
}

// ── 프롬프트 본문 ────────────────────────────────────────────
const indent = (s, n) => s.split('\n').map((l) => ' '.repeat(n) + l).join('\n')

function slideText(s, i, total) {
  const n = i + 1
  const head = `${n}장`
  if (s.kind === 'cover') {
    return `${head}  (표지 — ${COVER_NOTE})\n${indent(`제목: ${s.title.replace(/\n/g, ' / ')}`, 6)}\n${indent(`설명: ${s.sub}`, 6)}`
  }
  if (s.kind === 'point') {
    const lines = [`라벨: ${s.label}   (앰버 34px + 그 아래 앰버 밑줄 96×6)`, `제목: ${s.title.replace(/\n/g, ' / ')}`]
    if (s.desc) lines.push(`설명: ${s.desc.replace(/\n/g, ' / ')}`)
    return `${head}\n${indent(lines.join('\n'), 6)}`
  }
  if (s.kind === 'list') {
    const items = s.items.map((t) => `· ${t}`).join('\n')
    return `${head}\n${indent(`제목: ${s.title.replace(/\n/g, ' / ')}`, 6)}\n${indent('목록 (36px 흰색 72%, 각 앞에 앰버 정사각형 10×10, 항목 간격 28px)', 6)}\n${indent(items, 8)}`
  }
  if (s.kind === 'say') {
    return `${head}  ${s.who} · ${s.mood}\n${indent(s.title, 6)}`
  }
  if (s.kind === 'doc') {
    return `${head}  서류 (인물 없음)\n${indent(s.title, 6)}\n${indent('흰색 문서 카드에 굵은 글자만. 결정적 한 줄에 앰버 형광 밑줄.\n카드 오른쪽 위에 「예시」 배지를 반드시 넣을 것', 6)}`
  }
  // end
  return `${head}  (마지막 장)\n${indent(`제목: ${s.title}`, 6)}\n${indent(`설명: ${s.desc}`, 6)}`
}

function buildPrompt({ series, total, num, title, slides, comic }) {
  const n = slides.length
  const body = slides.map((s, i) => slideText(s, i, n)).join('\n\n')

  const sizes = comic
    ? `제목 88px 900. 말은 흰 말풍선, 생각은 점선 내레이션으로 구분할 것.`
    : `제목 88px 900, 설명 40px 흰색 72%, 라벨 34px 앰버 #E9A23B.`

  return `「${series}」 #${num} — ${title}
인스타그램 캐러셀 ${n}장을 만들어줘.

[규격]
아트보드 ${n}개를 가로로 나란히. 각 1080 × 1350 px.
바탕 딥네이비 #0C2247, 강조 앰버 #E9A23B, 글자 흰색.
서체 Gothic A1(없으면 Noto Sans KR). 차분하고 사무적인 톤. 느낌표 쓰지 말 것.
안전 여백: 위아래 각 120px, 좌우 각 90px 안에 모든 요소가 들어올 것.

[연재 고정 — ${total}화 내내 똑같은 자리 같은 크기로]
1장 좌측 상단    "${series}" 30px 앰버 #E9A23B  +  "#${num}" 52px 흰색 900
2장부터 우측 상단 "2/${n}" 형식 번호 28px 흰색 40%
모든 장 좌측 하단 "입주해" 워드마크 30px 흰색 60%
마지막 장        다음 화 예고 — 절대 빼지 말 것
이 네 가지가 화마다 흔들리면 연재로 읽히지 않는다.

[글자]
${sizes}
한글 제목은 88px이 상한이다. 더 키우면 열 글자 넘는 줄이 실사용 폭 900px을 넘겨 깨진다.

[장별 내용 — 문구를 한 글자도 바꾸지 말 것]
${body}

[금지]
사람 일러스트, 이모지, 스톡 이미지, 그라데이션 배경, 영어 문구.
한글 맞춤법과 띄어쓰기를 지킬 것.`
}

// ── 실행 ─────────────────────────────────────────────────────
export async function collect() {
  const out = []

  for (const s of SERIES) {
    for (const set of s.sets) {
      out.push({
        series: s.name,
        track: s.track,
        source: s.source,
        num: set.num,
        title: set.title,
        next: set.next,
        slides: set.slides,
        count: set.slides.length,
        prompt: buildPrompt({ series: s.name, total: s.total, ...set }),
      })
    }
  }

  const comicSrc = await readFile(path.join(POSTS, '05-series-comic.md'), 'utf8')
  for (const set of comicSets(comicSrc)) {
    out.push({
      series: '지수의 계약',
      track: '도달 · 세입자',
      source: '05-series-comic.md',
      num: set.num,
      title: set.title,
      next: set.next,
      slides: set.slides,
      count: set.slides.length,
      prompt: buildPrompt({ series: '지수의 계약', total: 12, ...set, comic: true }),
    })
  }

  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sets = await collect()
  const bySeries = {}
  for (const s of sets) bySeries[s.series] = (bySeries[s.series] ?? 0) + 1
  console.log('세트:', bySeries)
  console.log('총', sets.length, '세트 ·', sets.reduce((a, s) => a + s.count, 0), '장')
}
