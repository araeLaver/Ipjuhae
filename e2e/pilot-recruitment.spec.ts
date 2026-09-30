import { test, expect } from '@playwright/test'

const pageErrors = new WeakMap<object, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  // 로컬 화면 검증에서 통계 수집이나 실수로 발생한 신청을 DB에 보내지 않는다.
  await page.route('**/api/analytics/event', (route) => route.fulfill({ status: 202, json: {} }))
  await page.route('**/api/waitlist', (route) => route.request().method() === 'POST'
    ? route.abort()
    : route.fulfill({ json: { count: 0 } }))
})
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
})

test('홈에서 준비 상태를 읽고 실제 파일럿 폼으로 이동한다', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '서로 확인하는 임대차, 파일럿 참여' })).toBeVisible()
  await expect(page.getByText('DataScore와 계약 전 확인 리포트는 준비 중이며', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: '보증금 점검하기', exact: true })).toHaveAttribute('href', '/check')
  await expect(page.getByRole('link', { name: '안드로이드 테스터로 참여' })).toHaveAttribute('href', '/tester')
  await page.locator('main > section').first().screenshot({ path: `../evidence/home-${testInfo.project.name}.png` })
  await page.getByRole('link', { name: '파일럿 신청하기', exact: true }).click()
  await expect(page).toHaveURL(/\/about#waitlist-form$/)
  await expect(page.locator('#waitlist-form')).toBeInViewport()
  await expect(page.getByRole('form', { name: '사전 신청 폼' })).toBeVisible()
})

test('미리보기의 두 신청 링크 모두 실제 폼을 가리킨다', async ({ page }) => {
  await page.goto('/preview')
  for (const name of ['사전 신청하고 초대받기', '사전 신청하기']) {
    const link = page.getByRole('link', { name, exact: true })
    await expect(link).toHaveAttribute('href', '/about#waitlist-form')
    await link.click()
    await expect(page).toHaveURL(/\/about#waitlist-form$/)
    await expect(page.locator('#waitlist-form')).toBeInViewport()
    await page.goto('/preview')
  }
})

test('세 역할을 선택하고 임대인 신청을 로컬 모의 API로 전달한다', async ({ page }, testInfo) => {
  // 이 테스트는 DB에 쓰지 않는다. 브라우저에서 API 요청을 가로채 응답한다.
  let submitted: Record<string, unknown> | undefined
  await page.route('**/api/waitlist', async (route) => {
    if (route.request().method() === 'POST') submitted = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: { message: '신청이 완료되었습니다', count: 1 } })
  })
  await page.goto('/about#waitlist-form')
  const form = page.getByRole('form', { name: '사전 신청 폼' })
  for (const name of ['임차인', '중개사무소', '임대인']) {
    await form.getByRole('button', { name, exact: true }).click()
    await expect(form.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(form.locator('[aria-pressed="true"]')).toHaveCount(1)
  }
  await page.locator('#waitlist-form').screenshot({ path: `../evidence/pilot-${testInfo.project.name}.png` })
  await form.getByRole('textbox', { name: '이메일 *', exact: true }).fill('pilot@example.invalid')
  await form.getByRole('checkbox').check()
  await form.getByRole('button', { name: '파일럿 신청하기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '신청 완료', exact: true })).toBeVisible()
  expect(submitted).toMatchObject({ email: 'pilot@example.invalid', user_type: 'landlord', consent: true })
})
