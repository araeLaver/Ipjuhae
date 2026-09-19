#!/usr/bin/env node
/**
 * 앱 아이콘 생성기.
 *
 * 브라우저 탭의 파비콘(`app/icon.svg`)만 브랜드 색이고 PWA 홈화면 아이콘과
 * 모바일 앱 아이콘은 옛 초록색으로 남아 있었다. 같은 서비스로 보이지 않는다.
 * 파비콘 디자인을 기준으로 전부 다시 만든다.
 *
 *   node scripts/generate-app-icons.mjs
 */
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

const BUTTER = '#fff3dc'
const ORANGE = '#f0663f'
const AMBER = '#e8a33d'

/** 파비콘과 같은 마크. 지붕 선 하나와 점 두 개. */
const mark = (stroke, dotA, dotB) => `
  <path d="M9 24 L24 11 L39 24" fill="none" stroke="${stroke}" stroke-width="5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="18.5" cy="30.5" r="4" fill="${dotA}"/>
  <circle cx="29.5" cy="30.5" r="4" fill="${dotB}"/>`

/** 정사각 아이콘. 배경을 채우고 마크를 얹는다. */
const squareIcon = (bg, stroke, dotA, dotB, radius) => `
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="${radius}" fill="${bg}"/>
  ${mark(stroke, dotA, dotB)}
</svg>`

/**
 * 안드로이드 적응형 아이콘의 앞면. 배경색은 app.json이 칠하므로 여기선 비운다.
 * 바깥 25%는 기기가 잘라낼 수 있어 마크를 가운데로 줄인다.
 */
const adaptiveForeground = `
<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(24 24) scale(0.62) translate(-24 -24)">
    ${mark(BUTTER, BUTTER, AMBER)}
  </g>
</svg>`

const TARGETS = [
  { file: 'public/app-icon-1024.png', size: 1024, svg: squareIcon(BUTTER, ORANGE, ORANGE, AMBER, 11) },
  { file: 'public/app-icon-512.png', size: 512, svg: squareIcon(BUTTER, ORANGE, ORANGE, AMBER, 11) },
  { file: 'public/app-icon-256.png', size: 256, svg: squareIcon(BUTTER, ORANGE, ORANGE, AMBER, 11) },
  { file: 'mobile/assets/icon.png', size: 1024, svg: squareIcon(BUTTER, ORANGE, ORANGE, AMBER, 0) },
  { file: 'mobile/assets/adaptive-icon.png', size: 1024, svg: adaptiveForeground },
  { file: 'mobile/assets/favicon.png', size: 48, svg: squareIcon(BUTTER, ORANGE, ORANGE, AMBER, 11) },
  { file: 'mobile/assets/notification-icon.png', size: 96, svg: adaptiveForeground },
  { file: 'mobile/assets/splash.png', size: 1024, svg: squareIcon(BUTTER, ORANGE, ORANGE, AMBER, 0) },
]

const browser = await chromium.launch({ channel: 'chrome' })
for (const t of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: t.size, height: t.size },
    deviceScaleFactor: 1,
  })
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
       html,body{margin:0;padding:0;background:transparent}
       svg{display:block;width:${t.size}px;height:${t.size}px}
     </style></head><body>${t.svg}</body></html>`
  )
  await page.screenshot({ path: path.resolve(t.file), omitBackground: true })
  await page.close()
  console.log(`✓ ${t.file}  ${t.size}x${t.size}`)
}
await browser.close()
