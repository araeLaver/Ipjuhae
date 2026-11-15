// 실제 Chromium에서 저장 검색 적용·새로고침·URL 직접 진입을 검증한다. API는 fixtures다.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
const base = process.env.SAVED_SEARCH_BROWSER_URL || 'http://127.0.0.1:3106'
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
const cases = [
  { q: '합정', region: '서울', propertyType: 'oneroom', sort: 'monthly_rent', label: '합정 · 서울 · 원룸 · 월세순' },
  { q: '한강 뷰 & 역세권', region: '경기', propertyType: 'apartment', sort: 'deposit', label: '한강 뷰 & 역세권 · 경기 · 아파트 · 보증금순' },
  { q: '', region: '', propertyType: '', sort: 'created_at', label: '전체 매물 · 최신순' },
  { q: '', region: '', propertyType: '', sort: 'view_count', label: '전체 매물 · 조회순' },
]
const browser = await chromium.launch({ headless: true })
const errors = [], consoleErrors = [], requests = []
const signature = params => JSON.stringify(['q', 'region', 'type', 'sort'].map(key => params.get(key) || ''))
try {
  const page = await browser.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let body = {}
    if (url.pathname === '/api/properties') {
      requests.push(url.href)
      body = { properties: [{ id: 'qa-url', title: `QA 결과 ${signature(url.searchParams)}`, address: '검수용 주소', deposit: 0, monthlyRent: 0, maintenanceFee: 0, propertyType: url.searchParams.get('type') || 'oneroom', viewCount: 0 }], hasMore: false, nextCursor: null }
    } else if (url.pathname === '/api/saved-searches') body = { searches: cases.map((item, index) => ({ ...item, id: `qa-${index}`, alerts_enabled: false })), alertsAvailable: false }
    else if (url.pathname === '/api/notifications') body = { notifications: [], unreadCount: 0, nextCursor: null }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  async function check(item) {
    const url = new URL(page.url()), params = url.searchParams
    for (const [key, value] of Object.entries({ q: item.q, region: item.region, type: item.propertyType, sort: item.sort })) assert.equal(params.get(key) || '', value)
    assert.equal(params.has('cursor'), false)
    await expect(page.getByRole('textbox', { name: '지역명, 건물명으로 검색' })).toHaveValue(item.q)
    await expect(page.getByText(`QA 결과 ${signature(params)}`, { exact: true })).toBeVisible()
    assert.equal(signature(new URL(requests.at(-1)).searchParams), signature(params))
    if (await page.getByRole('button', { name: '저장한 검색', exact: true }).getAttribute('aria-expanded') !== 'true') await page.getByRole('button', { name: '저장한 검색', exact: true }).click()
    await expect(page.getByText(`현재 조건: ${item.label}`, { exact: true })).toBeVisible()
    if (await page.getByRole('button', { name: '검색 필터', exact: true }).getAttribute('aria-expanded') !== 'true') await page.getByRole('button', { name: '검색 필터', exact: true }).click()
    const selects = page.getByRole('combobox')
    await expect(selects.nth(0)).toHaveText(item.region || '전체')
    await expect(selects.nth(1)).toHaveText(item.propertyType === 'apartment' ? '아파트' : item.propertyType === 'oneroom' ? '원룸' : '전체')
    await expect(selects.nth(2)).toHaveText(item.label.split(' · ').at(-1))
    assert.equal(await page.locator('[data-nextjs-dialog]').count(), 0)
  }
  for (const [index, item] of cases.entries()) {
    await page.goto(`${base}/properties?q=합정&region=서울&type=oneroom&sort=created_at&cursor=old#results`)
    await expect(page.getByRole('textbox', { name: '지역명, 건물명으로 검색' })).toHaveValue('합정')
    await page.getByRole('button', { name: '저장한 검색', exact: true }).click()
    const apply = page.getByRole('button', { name: `${item.label} 이 조건으로 검색`, exact: true })
    await apply.focus(); await page.keyboard.press('Enter')
    await check(item)
    assert.equal(new URL(page.url()).hash, '#results')
    const applied = page.url()
    await page.reload(); await check(item)
    await page.goto(`${base}/properties?sort=deposit`)
    await page.goto(applied); await check(item)
    await page.screenshot({ path: `/tmp/dow-1419-url-${index}.png`, fullPage: true })
    console.log(`통과: ${item.label} — 적용·새로고침·URL 직접 진입의 화면·URL·API·결과 일치`)
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ pageerror: errors, consoleErrors }, null, 2))
} finally { await browser.close() }
