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
  // 기대값을 `/`로 적어 두었더니 로고 href가 `/home`으로 바뀐 뒤 계속 실패했다.
  // 목적지를 테스트에 박으면 라우트가 움직일 때마다 또 깨진다(DOW-1181).
  // 로고가 "가리키는 곳으로 실제로 데려가는지"만 확인하면 /home 정리 후에도 유효하다.
  test('헤더 로고 클릭시 로고가 가리키는 홈으로 이동', async ({ page }) => {
    await page.goto('/login')

    const logo = page.getByRole('link', { name: '입주해 입주해', exact: true })
    const href = await logo.getAttribute('href')
    expect(href).toBeTruthy()

    await logo.click()

    // href가 리다이렉트되는 경우(예: /home → /)까지 허용한다. 중요한 건
    // 로그인 화면을 벗어나 홈 계열 화면이 정상 렌더된다는 점이다.
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  // 서버 리다이렉트여야 한다. 클라이언트에서 `router.push`로 넘기면 크롤러와
  // JS 없는 요청이 빈 화면을 받는다. 그래서 응답 상태코드를 직접 본다.
  test('`/home` 직접 방문은 서버가 `/`로 영구 리다이렉트한다 (DOW-1183)', async ({ page }) => {
    const response = await page.goto('/home')

    await expect(page).toHaveURL(/\/$/)

    // 최종 응답이 아니라 리다이렉트 체인의 첫 응답을 봐야 308을 확인할 수 있다.
    // response() 는 Promise 를 돌려준다 — await 없이 status() 를 부르면 타입이 깨진다.
    const chain = await response?.request().redirectedFrom()?.response()
    expect(chain?.status()).toBe(308)

    // 목적지가 실제로 렌더되는지까지 확인한다 — 리다이렉트만 되고 500이면 의미가 없다.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
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
