#!/usr/bin/env node
/**
 * SNS 디자인 아트보드(.dc.html) → 게시용 PNG 내보내기.
 *
 * 캔버스 에디터용 .dc.html은 그대로는 업로드할 수 없다. 본문만 뽑아
 * 독립 HTML로 만든 뒤 시스템 Chrome으로 아트보드 크기 그대로 캡처한다.
 *
 *   node scripts/export-sns-artboards.mjs [--out <디렉터리>]
 */
import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CANVAS_DIR = path.resolve('marketing/sns/canvas')
const outArgIndex = process.argv.indexOf('--out')
const OUT_DIR = path.resolve(
  outArgIndex !== -1 ? process.argv[outArgIndex + 1] : 'marketing/sns/exports'
)

/** .dc.html에서 <helmet>(폰트·전역 스타일)과 아트보드 본문을 분리한다. */
function extractArtboard(source) {
  const helmet = source.match(/<helmet>([\s\S]*?)<\/helmet>/)?.[1] ?? ''
  const body = source.match(/<\/helmet>([\s\S]*?)<\/x-dc>/)?.[1]
  if (!body) throw new Error('아트보드 본문을 찾지 못했습니다')
  // 캔버스 런타임 전용 스크립트 블록은 정적 렌더에 불필요하다.
  return { helmet, body: body.replace(/<script[\s\S]*?<\/script>/g, '').trim() }
}

function standalonePage({ helmet, body }) {
  return `<!doctype html><html><head><meta charset="utf-8">${helmet}
<style>html,body{margin:0;padding:0}</style></head><body>${body}</body></html>`
}

const canvas = JSON.parse(await readFile(path.join(CANVAS_DIR, 'canvas.json'), 'utf8'))
await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const results = []

for (const artboard of canvas.artboards) {
  const source = await readFile(path.join(CANVAS_DIR, artboard.file), 'utf8')
  const page = await browser.newPage({
    viewport: { width: artboard.w, height: artboard.h },
    deviceScaleFactor: 1,
  })
  await page.setContent(standalonePage(extractArtboard(source)), { waitUntil: 'networkidle' })
  // 웹폰트가 적용되기 전에 찍으면 자간·줄바꿈이 달라진다.
  await page.evaluate(() => document.fonts.ready)

  const name = artboard.file.replace(/\.dc\.html$/, '.png')
  await page.screenshot({ path: path.join(OUT_DIR, name) })
  await page.close()

  results.push({ name, size: `${artboard.w}x${artboard.h}` })
  console.log(`✓ ${name} (${artboard.w}x${artboard.h})`)
}

await browser.close()
await writeFile(
  path.join(OUT_DIR, 'MANIFEST.json'),
  JSON.stringify({ exported: results }, null, 2) + '\n'
)
console.log(`\n${results.length}장 → ${OUT_DIR}`)
