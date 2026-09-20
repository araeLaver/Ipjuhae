#!/usr/bin/env node
/* eslint-disable no-console */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const MOBILE_DIR = 'mobile'
const APP_JSON = join(MOBILE_DIR, 'app.json')
const THEME_FILE = join(MOBILE_DIR, 'src', 'theme.ts')

// 출시 자산 규격은 출시 체크리스트의 기준을 따른다.
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

function report(failures) {
  console.error('mobile:launch-check failed')
  failures.forEach((item) => console.error(` - ${item}`))
  process.exit(1)
}

function sameColor(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
}

// 브랜드 색을 이 파일에 적어 두면 팔레트의 두 번째 사본이 된다. 이식 전 원본이
// 정확히 그래서 죽어 있었다 — `#B95545`/`#F8F5EF`를 요구했지만 그 값은 main
// 어디에도 없고 실제 브랜드는 `#F0663F`/`#FBF6EF`다. 그래서 색은 적지 않고
// theme에서 읽는다. 모양이 달라지면 조용히 넘어가지 않고 실패한다.
function readThemeColor(name) {
  if (!existsSync(THEME_FILE)) {
    return { error: `${THEME_FILE} is missing, cannot resolve brand color "${name}"` }
  }

  const source = readFileSync(THEME_FILE, 'utf8')
  const match = source.match(new RegExp(`\\b${name}\\s*:\\s*'(#[0-9a-fA-F]{6})'`))
  if (!match) {
    return { error: `could not read colors.${name} from ${THEME_FILE}` }
  }

  return { value: match[1] }
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

// splash 설정은 최상위 `expo.splash`에도, `expo-splash-screen` 플러그인
// 항목에도 둘 수 있다. 어디에 적혔는지가 아니라 실제 값이 맞는지가 중요하므로
// 양쪽 다 받아들인다.
function resolveSplashConfig(app) {
  const plugin = app.plugins?.find(
    (entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen',
  )
  return plugin?.[1] ?? app.splash ?? null
}

async function main() {
  const failures = []

  // 원본은 app.json이 없을 때 실패를 기록하고도 그대로 읽어 들여 ENOENT로
  // 죽었다. 그러면 무엇이 잘못됐는지가 아니라 스택 트레이스만 남는다.
  if (!existsSync(APP_JSON)) {
    fail(failures, 'mobile/app.json is missing')
    report(failures)
  }

  const app = JSON.parse(readFileSync(APP_JSON, 'utf8')).expo
  const primary = readThemeColor('primary')
  const background = readThemeColor('background')
  if (primary.error) fail(failures, primary.error)
  if (background.error) fail(failures, background.error)

  if (app.name !== '입주해') fail(failures, 'expo.name must be 입주해')
  if (app.slug !== 'ipjuhae') fail(failures, 'expo.slug must be ipjuhae')
  if (app.ios?.bundleIdentifier !== 'com.ipjuhae.app') {
    fail(failures, 'ios.bundleIdentifier must be com.ipjuhae.app')
  }
  if (app.android?.package !== 'com.ipjuhae.app') {
    fail(failures, 'android.package must be com.ipjuhae.app')
  }

  if (primary.value && !sameColor(app.android?.adaptiveIcon?.backgroundColor, primary.value)) {
    fail(
      failures,
      `android.adaptiveIcon.backgroundColor must match colors.primary ${primary.value}, got ${app.android?.adaptiveIcon?.backgroundColor}`,
    )
  }

  const notificationsPlugin = app.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
  )
  if (!notificationsPlugin) {
    fail(failures, 'expo-notifications plugin is missing')
  } else if (primary.value && !sameColor(notificationsPlugin[1]?.color, primary.value)) {
    fail(
      failures,
      `expo-notifications color must match colors.primary ${primary.value}, got ${notificationsPlugin[1]?.color}`,
    )
  }

  const splash = resolveSplashConfig(app)
  if (!splash) {
    fail(failures, 'splash config is missing (expo.splash or the expo-splash-screen plugin)')
  } else {
    if (splash.image !== './assets/splash.png') {
      fail(failures, `splash image must be ./assets/splash.png, got ${splash.image}`)
    }
    if (splash.resizeMode !== 'contain') {
      fail(failures, `splash resizeMode must be contain, got ${splash.resizeMode}`)
    }
    if (background.value && !sameColor(splash.backgroundColor, background.value)) {
      fail(
        failures,
        `splash backgroundColor must match colors.background ${background.value}, got ${splash.backgroundColor}`,
      )
    }
  }

  if (!/^https:\/\/.+\/api$/.test(app.extra?.apiUrl || '')) {
    fail(failures, 'extra.apiUrl must be a production HTTPS /api origin')
  }
  if (app.extra?.eas?.projectId === 'your-project-id') {
    fail(failures, 'extra.eas.projectId must not use the placeholder your-project-id')
  }

  await Promise.all(
    REQUIRED_ASSETS.map(([file, width, height]) => checkAsset(failures, file, width, height)),
  )

  if (failures.length > 0) {
    report(failures)
  }

  console.info('mobile:launch-check passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
