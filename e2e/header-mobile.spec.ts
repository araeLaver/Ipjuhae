import { test, expect } from '@playwright/test'

for (const [role, label, href] of [
  ['tenant', '프로필', '/profile'],
  ['landlord', '집주인 홈', '/landlord'],
  ['broker', '중개사 프로필', '/profile'],
  ['admin', '관리자 홈', '/admin'],
]) {
  test(`${role}: 375px 메뉴와 로그아웃`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 })
    let loggedIn = true
    await page.route('**/api/auth/me', route => route.fulfill({ json: {
      user: loggedIn ? { id: 'header-test', email: `${role}@example.com`, userType: role } : null,
    } }))
    await page.route('**/api/notifications**', route => route.fulfill({ json: { notifications: [], unreadCount: 0 } }))
    await page.route('**/api/auth/logout', route => {
      loggedIn = false
      return route.fulfill({ json: { success: true } })
    })
    await page.goto('/community')
    const menu = page.getByRole('button', { name: '메뉴 열기' })
    await expect(menu).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`${role}-header.png`) })
    await menu.click()
    const roleLink = page.getByRole('link', { name: label, exact: true }).last()
    await expect(roleLink).toBeVisible()
    await expect(roleLink).toHaveAttribute('href', href)
    const logout = page.getByRole('button', { name: '로그아웃', exact: true })
    await logout.scrollIntoViewIfNeeded()
    await expect(logout).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath(`${role}-menu.png`) })
    await logout.click()
    await expect(menu).toBeHidden()
    expect(loggedIn).toBe(false)
  })
}

test('비로그인 사용자는 인증 메뉴가 없음', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { user: null } }))
  await page.goto('/community')
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeHidden()
})

test('로그아웃 실패를 알리고 다시 시도할 수 있음', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  let loggedIn = true
  let logoutCalls = 0
  await page.route('**/api/auth/me', route => route.fulfill({ json: {
    user: loggedIn ? { id: 'header-test', email: 'landlord@example.com', userType: 'landlord' } : null,
  } }))
  await page.route('**/api/notifications**', route => route.fulfill({ json: { notifications: [], unreadCount: 0 } }))
  // 첫 시도는 실패시키고 두 번째 시도만 성공시킨다.
  await page.route('**/api/auth/logout', route => {
    logoutCalls += 1
    if (logoutCalls === 1) return route.fulfill({ status: 500, json: {} })
    loggedIn = false
    return route.fulfill({ json: { success: true } })
  })
  await page.goto('/community')
  const menu = page.getByRole('button', { name: '메뉴 열기' })
  await menu.click()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  // Next.js가 모든 페이지에 넣는 라우트 안내 엘리먼트도 role="alert"를 갖는다.
  // 좁히지 않으면 strict mode violation으로 여기서 멈춘다.
  const logoutError = page.getByRole('alert').filter({ hasText: '로그아웃하지 못했습니다' })
  await expect(logoutError).toContainText('로그아웃하지 못했습니다')
  await expect(menu).toBeVisible()
  await menu.click()
  const retry = page.getByRole('button', { name: '로그아웃', exact: true })
  await expect(retry).toBeVisible()
  await retry.click()
  await expect(menu).toBeHidden()
  expect(logoutCalls).toBe(2)
})
