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
// 대조군은 demo 격리 대상이 아닌 살아 있는 경로여야 한다. 전에는 `/home`이었는데
// 그 화면은 `/`로 영구 리다이렉트되며 제거됐다(DOW-1183). 리다이렉트를 타고
// 우연히 통과하는 대조군은 관측기가 죽어도 그 사실을 숨긴다.
const CONTROL_PATH = '/check'

/**
 * 외부 origin 허용 목록.
 *
 * Pretendard 웹폰트는 `app/globals.css`의 `@import`로 전역 테마가 의존하는 항목이고
 * [DOW-881](/DOW/issues/DOW-881)에서 CSP `style-src`/`font-src`에 의도적으로 허용됐다.
 * 따라서 위반이 아니지만, **허용했다는 사실은 반드시 출력**한다 —
 * 허용 목록이 조용히 마스킹하면 "외부 요청 0건"이라는 보고가 거짓이 된다.
 */
const ALLOWED_EXTERNAL_ORIGINS = new Map([
  ['https://cdn.jsdelivr.net', 'Pretendard 웹폰트 (globals.css @import, DOW-881에서 CSP 허용)'],
])

/**
 * document/script/style/font/image 같은 정적 자산은 격리 위반이 아니다.
 *
 * 단 origin이 같을 때만이다. 이전 판정은 non-`/api/` 이기만 하면 통과시켜서
 * **외부 origin 요청을 구조적으로 관측할 수 없었다.** 실제로 이 화면은
 * `cdn.jsdelivr.net`으로 stylesheet/font 2건을 보내고 있었는데 harness는 "0건"을 보고했다.
 * DOW-728 체크리스트가 외부 요청 부재를 요구하므로 origin을 따로 판정한다.
 */
function isStaticAsset(url, resourceType) {
  if (['document', 'script', 'stylesheet', 'font', 'image', 'other'].includes(resourceType)) {
    const { pathname, origin } = new URL(url)
    if (origin !== new URL(baseUrl).origin) return false
    return !pathname.startsWith('/api/')
  }
  return false
}

/** 위반 목록을 허용된 외부 origin과 진짜 위반으로 가른다. */
function splitExternal(requests) {
  const allowed = []
  const violations = []
  for (const req of requests) {
    const { origin } = new URL(req.url)
    if (origin !== new URL(baseUrl).origin && ALLOWED_EXTERNAL_ORIGINS.has(origin)) {
      allowed.push({ ...req, origin, reason: ALLOWED_EXTERNAL_ORIGINS.get(origin) })
    } else {
      violations.push(req)
    }
  }
  return { allowed, violations }
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

    const flagged = demo.requests.filter((r) => !isStaticAsset(r.url, r.resourceType))
    const { allowed, violations } = splitExternal(flagged)
    const controlApiCalls = control.requests.filter((r) => new URL(r.url).pathname.startsWith('/api/'))

    console.log(`\n[demo] ${DEMO_PATH} → HTTP ${demo.status}, 요청 ${demo.requests.length}건`)
    // 허용 목록이 무엇을 통과시켰는지 항상 드러낸다. 조용한 마스킹이 거짓 통과의 원인이다.
    for (const a of allowed) console.log(`  허용된 외부 요청: ${a.resourceType} ${a.origin} — ${a.reason}`)
    for (const v of violations) console.log(`  위반: ${v.resourceType} ${v.url}`)
    console.log(`[대조군] ${CONTROL_PATH} → HTTP ${control.status}, /api 요청 ${controlApiCalls.length}건`)
    for (const c of controlApiCalls) console.log(`  관측: ${new URL(c.url).pathname}`)

    const failures = []
    if (demo.status !== 200) failures.push(`demo route가 200이 아님 (${demo.status}) — PUBLIC_MOCK_DEMO_ENABLED=1 확인 필요`)
    if (violations.length > 0) {
      failures.push(`demo 경로에서 비정적 요청 또는 미허용 외부 origin 요청 ${violations.length}건 발생`)
    }
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
