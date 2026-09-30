import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const baseURL = process.env.SAVED_SEARCH_BROWSER_URL || 'http://127.0.0.1:3106'
if (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local test server required')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let searches = []
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let result = {}
    if (path === '/api/properties') result = { properties: [], hasMore: false, nextCursor: null }
    else if (path === '/api/saved-searches') {
      if (request.method() === 'POST') {
        const data = request.postDataJSON()
        searches = [{ ...data.filters, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', alerts_enabled: data.alertsEnabled, created_at: new Date().toISOString() }]
        result = { search: searches[0] }
      } else if (request.method() === 'PATCH') {
        searches[0].alerts_enabled = request.postDataJSON().alertsEnabled
        result = { search: searches[0] }
      } else if (request.method() === 'DELETE') { searches = []; result = { ok: true } }
      else result = { searches, alertsAvailable: true }
    } else if (path === '/api/notifications') result = { notifications: [], unreadCount: 0, nextCursor: null }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  await page.goto(`${baseURL}/properties?q=${encodeURIComponent('합정')}&region=${encodeURIComponent('서울')}&type=oneroom&sort=deposit`)
  await page.getByRole('heading', { name: '매물 찾기', exact: true }).waitFor()
  await page.getByRole('button', { name: '저장한 검색', exact: true }).click()
  await page.getByRole('checkbox', { name: '새 매물 알림 받기' }).check()
  await page.getByRole('button', { name: '현재 검색 조건 저장' }).click()
  await page.getByText('검색 조건을 저장했습니다', { exact: true }).waitFor()
  assert.equal(searches[0].q, '합정')
  assert.equal(searches[0].sort, 'deposit')
  assert.equal(searches[0].alerts_enabled, true)
  await page.getByRole('button', { name: /알림 끄기/ }).click()
  await page.getByText('알림 설정을 변경했습니다', { exact: true }).waitFor()
  assert.equal(searches[0].alerts_enabled, false)
  await page.getByRole('button', { name: '검색 필터', exact: true }).click()
  await page.getByRole('button', { name: '필터 초기화', exact: true }).first().click()
  await page.getByRole('button', { name: '이 조건으로 검색', exact: true }).click()
  assert.equal(await page.getByRole('textbox', { name: '지역명, 건물명으로 검색' }).inputValue(), '합정')
  await page.getByRole('button', { name: /검색 삭제/ }).click()
  await page.getByText('검색 조건을 삭제했습니다', { exact: true }).waitFor()
  assert.equal(searches.length, 0)
  assert.deepEqual(errors, [])
  console.log('PASS: production browser search restore, save, alert toggle, filter apply, delete; no page errors (API fixtures)')
} finally { await browser.close() }
