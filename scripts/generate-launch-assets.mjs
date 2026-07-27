#!/usr/bin/env node
/* eslint-disable no-console */

import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const BRAND = {
  coral: '#B95545',
  sage: '#61765B',
  paper: '#F8F5EF',
}

const sourceSvgPath = new URL('../public/app-icon.svg', import.meta.url)
const publicDir = new URL('../public/', import.meta.url)
const mobileAssetsDir = new URL('../mobile/assets/', import.meta.url)

async function pngFromSvg(svg, output, size) {
  await sharp(svg).resize(size, size, { fit: 'contain' }).png().toFile(fileURLToPath(output))
}

async function createSplash(svg) {
  const icon = await sharp(svg).resize(420, 420, { fit: 'contain' }).png().toBuffer()
  await sharp({
    create: {
      width: 1242,
      height: 2436,
      channels: 4,
      background: BRAND.paper,
    },
  })
    .composite([{ input: icon, left: 411, top: 820 }])
    .png()
    .toFile(fileURLToPath(new URL('splash.png', mobileAssetsDir)))
}

async function createNotificationIcon() {
  const notificationSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" fill="none"/>
      <path d="M18 45 48 20l30 25v34a5 5 0 0 1-5 5H23a5 5 0 0 1-5-5V45Z" fill="#FFFFFF"/>
      <rect x="40" y="58" width="16" height="26" rx="3" fill="${BRAND.coral}"/>
      <path d="m34 43 14-12 14 12" fill="none" stroke="${BRAND.coral}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `)

  await sharp(notificationSvg).resize(96, 96).png().toFile(fileURLToPath(new URL('notification-icon.png', mobileAssetsDir)))
}

async function main() {
  await mkdir(mobileAssetsDir, { recursive: true })
  const svg = await readFile(sourceSvgPath)

  await Promise.all([
    pngFromSvg(svg, new URL('app-icon-192.png', publicDir), 192),
    pngFromSvg(svg, new URL('app-icon-256.png', publicDir), 256),
    pngFromSvg(svg, new URL('app-icon-512.png', publicDir), 512),
    pngFromSvg(svg, new URL('app-icon-1024.png', publicDir), 1024),
    pngFromSvg(svg, new URL('app-icon-maskable-512.png', publicDir), 512),
    pngFromSvg(svg, new URL('icon.png', mobileAssetsDir), 1024),
    pngFromSvg(svg, new URL('adaptive-icon.png', mobileAssetsDir), 1024),
    pngFromSvg(svg, new URL('favicon.png', mobileAssetsDir), 48),
    createSplash(svg),
    createNotificationIcon(),
  ])

  console.info('launch assets generated')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
