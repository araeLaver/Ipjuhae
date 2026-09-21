#!/usr/bin/env node
/**
 * demo route 네트워크 격리 — 실제 브라우저 관측 검증.
 *
 * jsdom render 테스트(`__tests__/components/demo-network-isolation.test.tsx`)와 목적이 겹치지만,
 * 이쪽은 실제 Next.js dev server + 실제 Chrome에서 hydration 이후까지 관측한다.
 * QA가 08-03에 결함을 잡은 방식과 같은 층위의 증적을 남기기 위한 스크립트다.
 *
 * 사용법:
 *   PUBLIC_MOCK_DEMO_ENABLED=1 npm run dev -- --hostname 127.0.0.1 --port 3010
 *   node scripts/verify-demo-network-isolation.mjs http://127.0.0.1:3010
 *
 * 판정:
 *   - demo 경로에서 document/static chunk 외의 요청이 1건이라도 있으면 실패
 *   - 대조군(비 demo 경로)에서 /api/analytics/event가 관측되지 않으면 실패
 *     (관측기가 죽은 채로 "0건"을 보고하는 거짓 통과를 막는다)
 */

const baseUrl = (process.argv[2] || 'http://127.0.0.1:3010').replace(/\/$/, '')
const DEMO_PATH = '/demo/public-mock/listings'
const CONTROL_PATH = '/home'

/** document/script/style/font/image 같은 정적 자산은 격리 위반이 아니다. */
function isStaticAsset(url, resourceType) {
  if (['document', 'script', 'stylesheet', 'font', 'image', 'other'].includes(resourceType)) {
    const { pathname } = new URL(url)
    return !pathname.startsWith('/api/')
  }
  return false
}

async function collectRequests(browser, path) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const requests = []

  page.on('request', (req) => {
    requests.push({ url: req.url(), resourceType: req.resourceType() })
  })

  // networkidle을 기다리지 않는다. 위반 요청이 계속 발생하면 idle이 오지 않아 timeout으로
  // 죽고, 그러면 "위반 N건"이 아니라 "스크립트 실패"로 보고돼 원인이 가려진다.
  // load 이후 고정 시간 동안 관측만 한다 — sendBeacon은 hydration 뒤에 늦게 나간다.
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'load', timeout: 30_000 })
  await page.waitForTimeout(3000)
  const status = response?.status() ?? 0

  await context.close()
  return { status, requests }
}

async function main() {
  const { chromium } = await import('@playwright/test')
  // 전용 Chromium 다운로드 없이 시스템 Chrome을 쓴다.
  const browser = await chromium.launch({ channel: 'chrome' })

  try {
    const demo = await collectRequests(browser, DEMO_PATH)
    const control = await collectRequests(browser, CONTROL_PATH)

    const violations = demo.requests.filter((r) => !isStaticAsset(r.url, r.resourceType))
    const controlApiCalls = control.requests.filter((r) => new URL(r.url).pathname.startsWith('/api/'))

    console.log(`\n[demo] ${DEMO_PATH} → HTTP ${demo.status}, 요청 ${demo.requests.length}건`)
    for (const v of violations) console.log(`  위반: ${v.resourceType} ${v.url}`)
    console.log(`[대조군] ${CONTROL_PATH} → HTTP ${control.status}, /api 요청 ${controlApiCalls.length}건`)
    for (const c of controlApiCalls) console.log(`  관측: ${new URL(c.url).pathname}`)

    const failures = []
    if (demo.status !== 200) failures.push(`demo route가 200이 아님 (${demo.status}) — PUBLIC_MOCK_DEMO_ENABLED=1 확인 필요`)
    if (violations.length > 0) failures.push(`demo 경로에서 비정적 요청 ${violations.length}건 발생`)
    if (controlApiCalls.length === 0) {
      failures.push('대조군에서 /api 요청이 0건 — 관측기가 동작하지 않았을 수 있어 demo 결과를 신뢰할 수 없음')
    }

    if (failures.length > 0) {
      console.error('\n❌ 격리 검증 실패')
      for (const f of failures) console.error(`  - ${f}`)
      process.exitCode = 1
      return
    }

    console.log('\n✅ 격리 검증 통과 — demo 경로 비정적 요청 0건, 대조군 관측기 정상')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('검증 스크립트 실행 실패:', err)
  process.exitCode = 1
})
