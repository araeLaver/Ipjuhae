import { test, expect } from '@playwright/test'

const roles = [
  ['public', '보증금 점검', '/check'],
  ['tenant', '프로필', '/profile'],
  ['landlord', '집주인 홈', '/landlord'],
  ['broker', '중개사 프로필', '/profile'],
  ['admin', '관리자 홈', '/admin'],
] as const

for (const [role, label, href] of roles) {
  for (const width of [1280, 375]) {
    test(`${role}: ${width}px 모집 링크 노출·이동·기존 메뉴`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.route('**/api/auth/me', route => route.fulfill({ json: {
        user: role === 'public' ? null : { id: 'qa-header', email: `${role}@example.com`, userType: role },
      } }))
      await page.route('**/api/notifications**', route => route.fulfill({ json: { notifications: [], unreadCount: 0 } }))
      await page.goto('/community')
      const header = page.locator('header').first()
      if (role !== 'public' && width === 1280) await expect(header.locator('.cursor-pointer')).toBeVisible()
      if (width === 375) await page.getByRole('button', { name: '메뉴 열기' }).click()
      const nav = width === 375 ? page.getByRole('navigation', { name: '모바일 메뉴' }) : header.locator('nav')
      const link = nav.getByRole('link', { name: '앱 테스터 참여', exact: true })
      await expect(link).toHaveCount(1)
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', '/tester?from=header')
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href)
      await page.screenshot({ path: testInfo.outputPath('모집-메뉴.png'), fullPage: true })
      await link.click()
      await expect(page).toHaveURL(/\/tester\?from=header$/)
      await expect(page.getByRole('heading', { name: '부탁드릴 것은 버튼 한 번입니다' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: '모바일 메뉴' })).toHaveCount(0)
      if (role !== 'public' && width === 1280) {
        await page.goto('/community')
        await header.locator('.cursor-pointer').click()
        const item = page.getByRole('button', { name: '앱 테스터 참여', exact: true })
        await expect(item).toHaveCount(1)
        await item.click()
        await expect(page).toHaveURL(/\/tester\?from=header$/)
        await expect(page.getByRole('heading', { name: '부탁드릴 것은 버튼 한 번입니다' })).toBeVisible()
      }
    })
  }
}

test('동일 브라우저 역할 전환 후 모집 링크 유지·중복 없음', async ({ page }) => {
  let role = 'tenant'
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { email: 'qa@example.com', userType: role } } }))
  await page.route('**/api/notifications**', route => route.fulfill({ json: { notifications: [], unreadCount: 0 } }))
  for (const nextRole of ['tenant', 'landlord', 'broker', 'admin', 'tenant']) {
    role = nextRole
    await page.goto('/community')
    await expect(page.locator('header').first().locator('.cursor-pointer')).toBeVisible()
    await expect(page.locator('header nav').getByRole('link', { name: '앱 테스터 참여', exact: true })).toHaveCount(1)
  }
})
