// Run against a separate local build explicitly configured with a synthetic DB.
// Uses a fresh browser context; never supplies credentials or deletes an account.
import { chromium } from 'playwright'
const base = new URL(process.argv[2] || 'http://localhost:3317')
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Local synthetic server only')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const response = await page.goto(new URL('/account/delete', base).href)
  if (response.status() !== 200) throw new Error('Deletion entry is not public')
  await page.getByRole('heading', { name: '입주해 계정·데이터 삭제 요청' }).waitFor()
  const link = page.getByRole('link', { name: '로그인 후 삭제 요청' })
  if (await link.getAttribute('href') !== '/login?redirect=%2Faccount%2Fdelete') throw new Error('Login return path mismatch')
  if (await page.getByRole('button', { name: '계정 삭제 요청' }).count()) throw new Error('Unauthenticated delete control exposed')
  const endpoint = new URL('/api/account/delete', base).href
  const foreign = await page.request.delete(endpoint, { headers: { Origin: 'https://unrelated.invalid' } })
  if (foreign.status() !== 403) throw new Error('Foreign-origin CSRF request was not rejected')
  const unsigned = await page.request.delete(endpoint, { headers: { Origin: base.origin } })
  if (unsigned.status() !== 401) throw new Error('Unauthenticated same-origin mutation was allowed')
  await link.click()
  await page.waitForURL('**/login?redirect=%2Faccount%2Fdelete')
  console.log('PASS: public entry, preserved login return path, no unsigned destructive control, foreign-origin 403, unsigned same-origin 401')
} finally { await browser.close() }
