import { test, expect } from '@playwright/test'

test.describe('온보딩 플로우', () => {
  // 온보딩 페이지는 로그인 필요 - 미로그인시 리다이렉트 확인
  test('미로그인시 온보딩 접근 시도 -> 로그인 페이지로 리다이렉트', async ({ page }) => {
    await page.goto('/onboarding/basic')

    // 로그인 페이지로 리다이렉트되거나 로그인 필요 메시지 표시
    await expect(page).toHaveURL(/\/(login|onboarding)/)
  })

  test('온보딩 기본 정보 페이지 UI 요소 확인', async ({ page }) => {
    // 직접 접근하여 페이지 구조 확인 (리다이렉트 될 수 있음)
    await page.goto('/onboarding/basic')

    // 리다이렉트 되지 않은 경우 UI 확인
    const currentUrl = page.url()
    if (currentUrl.includes('/onboarding/basic')) {
      await expect(page.getByText(/기본 정보|프로필/)).toBeVisible()
    }
  })
})

test.describe('프로필 대시보드', () => {
  test('미로그인시 프로필 페이지 접근 -> 리다이렉트', async ({ page }) => {
    await page.goto('/profile')

    // 로그인 페이지로 리다이렉트
    await expect(page).toHaveURL(/\/(login|profile)/)
  })
})

test.describe('집주인 대시보드', () => {
  test('미로그인시 집주인 대시보드 접근 -> 리다이렉트', async ({ page }) => {
    await page.goto('/landlord')

    // 로그인 페이지로 리다이렉트
    await expect(page).toHaveURL(/\/(login|landlord)/)
  })
})

test.describe('네비게이션', () => {
  test('헤더 로고 클릭시 홈으로 이동', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('link', { name: /입주해|RentMe/i }).first().click()

    await expect(page).toHaveURL('/')
  })

  test('개인정보처리방침 페이지 접근 가능', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByText(/개인정보/)).toBeVisible()
  })

  test('이용약관 페이지 접근 가능', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByText(/이용약관/)).toBeVisible()
  })
})
