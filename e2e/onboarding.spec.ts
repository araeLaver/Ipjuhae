import { test, expect } from './fixtures'

test.describe('온보딩 플로우', () => {
  // 온보딩 페이지는 로그인 필요 - 미로그인시 리다이렉트 확인
  test('미로그인시 온보딩 접근 시도 -> 로그인 페이지로 리다이렉트', async ({ page }) => {
    await page.goto('/onboarding/basic')

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/login' &&
        url.searchParams.get('redirect') === '/onboarding/basic',
    )
  })

  test('온보딩 리다이렉트 후 로그인 UI 표시', async ({ page }) => {
    await page.goto('/onboarding/basic')

    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
    await expect(page.locator('form')).toBeVisible()
  })
})

test.describe('프로필 대시보드', () => {
  test('미로그인시 프로필 페이지 접근 -> 리다이렉트', async ({ page }) => {
    await page.goto('/profile')

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/login' &&
        url.searchParams.get('redirect') === '/profile',
    )
  })
})

test.describe('집주인 대시보드', () => {
  test('미로그인시 집주인 대시보드 접근 -> 리다이렉트', async ({ page }) => {
    await page.goto('/landlord')

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/login' &&
        url.searchParams.get('redirect') === '/landlord',
    )
  })
})

test.describe('네비게이션', () => {
  test('헤더 로고 클릭시 홈으로 이동', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('link', { name: 'RentMe', exact: true }).click()

    await expect(page).toHaveURL('/')
  })

  test('개인정보처리방침 페이지 접근 가능', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: '개인정보처리방침' })).toBeVisible()
  })

  test('이용약관 페이지 접근 가능', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: '이용약관' })).toBeVisible()
  })
})
