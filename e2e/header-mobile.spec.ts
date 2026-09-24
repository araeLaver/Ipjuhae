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
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: {
    email: 'landlord@example.com', userType: 'landlord',
  } } }))
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 500, json: {} }))
  await page.goto('/community')
  const menu = page.getByRole('button', { name: '메뉴 열기' })
  await menu.click()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('로그아웃하지 못했습니다')
  await expect(menu).toBeVisible()
  await menu.click()
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible()
})
