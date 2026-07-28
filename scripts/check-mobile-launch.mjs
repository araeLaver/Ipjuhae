#!/usr/bin/env node
/* eslint-disable no-console */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const MOBILE_DIR = 'mobile'
const APP_JSON = join(MOBILE_DIR, 'app.json')
const REQUIRED_ASSETS = [
  ['assets/icon.png', 1024, 1024],
  ['assets/adaptive-icon.png', 1024, 1024],
  ['assets/splash.png', 1242, 2436],
  ['assets/favicon.png', 48, 48],
  ['assets/notification-icon.png', 96, 96],
]

function fail(failures, message) {
  failures.push(message)
}

async function checkAsset(failures, relativePath, width, height) {
  const file = join(MOBILE_DIR, relativePath)
  if (!existsSync(file)) {
    fail(failures, `${file} is missing`)
    return
  }

  const metadata = await sharp(file).metadata()
  if (metadata.width !== width || metadata.height !== height) {
    fail(failures, `${file} should be ${width}x${height}, got ${metadata.width}x${metadata.height}`)
  }
}

async function main() {
  const failures = []
  if (!existsSync(APP_JSON)) {
    fail(failures, 'mobile/app.json is missing')
  }

  const app = JSON.parse(readFileSync(APP_JSON, 'utf8')).expo
  if (app.name !== '입주해') fail(failures, 'expo.name must be 입주해')
  if (app.slug !== 'ipjuhae') fail(failures, 'expo.slug must be ipjuhae')
  if (app.ios?.bundleIdentifier !== 'com.ipjuhae.app') {
    fail(failures, 'ios.bundleIdentifier must be com.ipjuhae.app')
  }
  if (app.android?.package !== 'com.ipjuhae.app') {
    fail(failures, 'android.package must be com.ipjuhae.app')
  }
  if (app.android?.adaptiveIcon?.backgroundColor !== '#B95545') {
    fail(failures, 'android.adaptiveIcon.backgroundColor must match Coral Clay #B95545')
  }
  const notificationsPlugin = app.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications')
  if (notificationsPlugin?.[1]?.color !== '#B95545') {
    fail(failures, 'expo-notifications color must match Coral Clay #B95545')
  }
  const splashPlugin = app.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')
  if (splashPlugin?.[1]?.image !== './assets/splash.png') {
    fail(failures, 'expo-splash-screen image must be ./assets/splash.png')
  }
  if (splashPlugin?.[1]?.resizeMode !== 'contain') {
    fail(failures, 'expo-splash-screen resizeMode must be contain')
  }
  if (splashPlugin?.[1]?.backgroundColor !== '#F8F5EF') {
    fail(failures, 'expo-splash-screen backgroundColor must match Warm Paper #F8F5EF')
  }
  if (!/^https:\/\/.+\/api$/.test(app.extra?.apiUrl || '')) {
    fail(failures, 'extra.apiUrl must be a production HTTPS /api origin')
  }
  if (app.extra?.eas?.projectId === 'your-project-id') {
    fail(failures, 'extra.eas.projectId must not use the placeholder your-project-id')
  }

  await Promise.all(REQUIRED_ASSETS.map(([file, width, height]) => checkAsset(failures, file, width, height)))

  if (failures.length > 0) {
    console.error('mobile:launch-check failed')
    failures.forEach((item) => console.error(` - ${item}`))
    process.exit(1)
  }

  console.info('mobile:launch-check passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
