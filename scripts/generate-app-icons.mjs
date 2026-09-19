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

// ── Play 피처 그래픽 ────────────────────────────────────────
// 스토어 목록 맨 위에 걸리는 가로 배너. 아이콘과 한 줄 설명만 둔다.
const feature = `
<div style="width:1024px;height:500px;box-sizing:border-box;background:${BUTTER};
            display:flex;align-items:center;gap:56px;padding:0 80px;
            font-family:'Gothic A1','Apple SD Gothic Neo',sans-serif">
  <div style="flex:none;width:200px;height:200px;border-radius:44px;background:#fff;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 8px 24px rgba(240,102,63,0.18)">
    <svg viewBox="0 0 48 48" style="width:130px;height:130px">
      ${mark(ORANGE, ORANGE, AMBER)}
    </svg>
  </div>
  <div>
    <div style="font-size:82px;font-weight:900;color:#262220;letter-spacing:-3px">입주해</div>
    <div style="margin-top:14px;font-size:34px;font-weight:700;color:${ORANGE}">계약 전에 물어보는 곳</div>
    <div style="margin-top:8px;font-size:25px;color:#6B625C;line-height:1.45">
      등기부와 보증금, 혼자 판단하기 어려운 것을<br>임차인·임대인·공인중개사가 함께 봅니다
    </div>
  </div>
</div>`

const fb = await chromium.launch({ channel: 'chrome' })
const fp = await fb.newPage({ viewport: { width: 1024, height: 500 } })
await fp.setContent(
  `<!doctype html><html><head><meta charset="utf-8">
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;700;900&display=swap">
   <style>html,body{margin:0;padding:0}</style></head><body>${feature}</body></html>`,
  { waitUntil: 'networkidle' }
)
await fp.evaluate(() => document.fonts.ready)
await fp.screenshot({ path: path.resolve('mobile/assets/play-feature-graphic.png') })
await fb.close()
console.log('✓ mobile/assets/play-feature-graphic.png  1024x500')
