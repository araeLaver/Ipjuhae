import { test, expect } from '@playwright/test'

test.describe('인증 흐름', () => {
  test('랜딩페이지 접근 가능', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/입주해|RentMe/i)
  })

  test('회원가입 페이지 접근 가능', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible()
  })

  test('로그인 페이지 접근 가능', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  })

  test('회원가입 폼 유효성 검사', async ({ page }) => {
    await page.goto('/signup')

    // 빈 폼 제출 시도
    await page.getByRole('button', { name: '가입하기' }).click()

    // 필수 필드 에러 확인 (브라우저 기본 validation)
    const emailInput = page.locator('#email')
    await expect(emailInput).toHaveAttribute('required', '')
  })

  test('로그인 페이지에서 회원가입 페이지로 이동', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: '회원가입' }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('회원가입 페이지에서 로그인 페이지로 이동', async ({ page }) => {
    await page.goto('/signup')
    await page.getByRole('link', { name: '로그인' }).click()
    await expect(page).toHaveURL('/login')
  })
})

test.describe('회원가입 유효성 검사', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
  })

  test('비밀번호 불일치 에러', async ({ page }) => {
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('different123')

    // 약관 동의
    await page.getByText('이용약관에 동의합니다').click()
    await page.getByText('개인정보처리방침에 동의합니다').click()

    await page.getByRole('button', { name: '가입하기' }).click()

    await expect(page.getByText('비밀번호가 일치하지 않습니다')).toBeVisible()
  })

  test('약관 미동의 에러', async ({ page }) => {
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password123')

    await page.getByRole('button', { name: '가입하기' }).click()

    await expect(page.getByText(/이용약관에 동의해주세요|개인정보처리방침에 동의해주세요/)).toBeVisible()
  })
})

test.describe('세입자/집주인 선택', () => {
  test('기본 선택은 세입자', async ({ page }) => {
    await page.goto('/signup')

    const tenantRadio = page.locator('#tenant')
    await expect(tenantRadio).toBeChecked()
  })

  test('집주인 선택 가능', async ({ page }) => {
    await page.goto('/signup')

    await page.getByText('집주인').click()

    const landlordRadio = page.locator('#landlord')
    await expect(landlordRadio).toBeChecked()
  })
})
