const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
;(async () => {
  const base = process.env.QA_BASE_URL || 'http://localhost:3197'
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), '로컬 환경만 허용')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 } })
    await page.route('**/api/auth/providers', route => route.fulfill({ json: { providers: [] } }))
    await page.route('**/api/auth/login', route => route.fulfill({ json: { user: { user_type: 'tenant' } } }))
    const api = await page.request.get(`${base}/api/auth/social/kakao`, { headers: { Accept: 'application/json' }, maxRedirects: 0 })
    assert.equal(api.status(), 503)
    assert.equal(api.headers()['set-cookie'], undefined)
    await page.goto(`${base}/api/auth/social/kakao?redirect=${encodeURIComponent('/community/abc?tab=latest')}`)
    await page.getByRole('status').filter({ hasText: '소셜 로그인을 사용할 수 없습니다' }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/login')
    const recovery = page.getByRole('button', { name: '이메일로 로그인', exact: true })
    await recovery.focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.locator('#email').evaluate(el => el === document.activeElement), true)
    assert.equal(await page.getByRole('button', { name: '카카오로 로그인' }).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: 'docs/qa/social-login-recovery-20261012/mobile.png', fullPage: true })
    // 720px viewport at 200% zoom has the equivalent CSS width of 360px.
    await page.getByLabel('이메일', { exact: true }).fill('fixture@example.com')
    await page.getByLabel('비밀번호', { exact: true }).fill('fixture-password')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await page.waitForURL('**/community/abc?tab=latest')
    const result = { apiStatus: api.status(), browserRecovery: true, keyboardEmailFocus: true, mobile360NoOverflow: true, passwordLoginRedirect: new URL(page.url()).pathname + new URL(page.url()).search, loginResponse: 'mock', screenReader: 'role=status 확인; 실제 음성 검수는 QA 필요' }
    fs.writeFileSync('docs/qa/social-login-recovery-20261012/browser-result.json', JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
