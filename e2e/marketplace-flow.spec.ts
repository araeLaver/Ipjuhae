import { test, expect } from './fixtures'

// Core marketplace loop: landlord posts a listing → tenant views its detail →
// tenant contacts the landlord. Requires an isolated test DB (see auth-flow.spec).
// Guards two regressions found 2026-08-25:
//   1) GET /api/properties/[id] referenced a non-existent profiles column.
//   2) The contact button POSTed to /api/messages (404) instead of
//      /api/messages/conversations.
test.skip(!process.env.PLAYWRIGHT_DATABASE_URL, 'PLAYWRIGHT_DATABASE_URL(격리 DB)에서만 실행')
test.setTimeout(150000)

const TERMS = /이용약관.*동의합니다/
const PRIVACY = /개인정보처리방침.*동의합니다/
const PW = 'marketflow01234'

function ip() {
  const o = () => 1 + Math.floor(Math.random() * 253)
  return `10.${o()}.${o()}.${o()}`
}

async function signup(page: import('@playwright/test').Page, mail: string, role: 'tenant' | 'landlord') {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ip() })
  await page.goto('/signup')
  await page.locator('#email').fill(mail)
  await page.locator('#password').fill(PW)
  await page.locator('#confirmPassword').fill(PW)
  if (role === 'landlord') await page.locator('label[for="landlord"]').click()
  await page.getByRole('checkbox', { name: TERMS }).check()
  await page.getByRole('checkbox', { name: PRIVACY }).check()
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/signup'), { timeout: 15000 }),
    page.getByRole('button', { name: '가입하기' }).click(),
  ])
}

test('집주인 매물 등록 → 세입자 상세 조회 → 집주인에게 연락', async ({ page, browser }) => {
  // 집주인: 매물 등록 (UI 폼과 동일한 엔드포인트)
  await signup(page, `mfl_land_${Date.now()}@example.com`, 'landlord')
  const createRes = await page.request.post('/api/landlord/properties', {
    data: {
      title: '마켓플레이스 검증 매물',
      address: '서울특별시 강남구 테헤란로 123',
      region: '서울 강남구',
      deposit: 10_000_000,
      monthlyRent: 550_000,
      propertyType: 'oneroom',
    },
  })
  expect(createRes.ok()).toBeTruthy()
  const createBody = await createRes.json()
  const propertyId = createBody.property?.id ?? createBody.id
  expect(propertyId).toBeTruthy()

  // 세입자: 매물 상세가 500 없이 열리고 연락 버튼이 보인다
  const tctx = await browser.newContext()
  const tpage = await tctx.newPage()
  await signup(tpage, `mfl_ten_${Date.now()}@example.com`, 'tenant')

  const detailApi = await tpage.request.get(`/api/properties/${propertyId}`)
  expect(detailApi.ok()).toBeTruthy() // regression #1: was 500

  await tpage.goto(`/properties/${propertyId}`, { waitUntil: 'networkidle', timeout: 20000 })
  const contactBtn = tpage.getByRole('button', { name: /집주인에게 연락하기/ })
  await expect(contactBtn).toBeVisible()

  // 연락 → 대화 생성 (regression #2: was POST /api/messages → 404)
  const [resp] = await Promise.all([
    tpage.waitForResponse((r) => r.url().includes('/api/messages/conversations') && r.request().method() === 'POST', { timeout: 15000 }),
    contactBtn.click(),
  ])
  expect(resp.ok()).toBeTruthy()
  expect((await resp.json()).conversationId).toBeTruthy()

  await tctx.close()
})
