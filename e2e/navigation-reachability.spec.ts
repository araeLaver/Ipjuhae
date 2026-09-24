/**
 * 살아 있는 공개 화면에 "링크로 실제로 닿을 수 있는지" 검증한다 (DOW-1183 회귀).
 *
 * DOW-1183에서 `/home`을 지우면서 `/properties`로 가는 유일한 동선("헤더 로고 →
 * /home → 매물 찾기")이 같이 끊겼다. 화면은 200으로 살아 있었고 테스트 24건도
 * 전부 통과했다 — 아무도 닿을 수 없다는 사실만 아무 테스트도 보지 않았다.
 *
 * 그래서 존재(200)가 아니라 도달(클릭)을 단언한다. `href` 문자열 grep으로는
 * 라우트가 조용히 404가 되거나 링크가 숨겨진 경우를 못 잡으므로 실제 클릭으로 본다.
 */
import { test, expect } from './fixtures'

test.describe('공개 화면 도달 가능성', () => {
  test('홈에서 클릭만으로 `/properties`(매물 찾기)에 닿는다 (DOW-1183)', async ({ page }) => {
    await page.goto('/')

    const link = page.locator('a[href="/properties"]').first()
    await expect(
      link,
      '홈에 `/properties` 진입 링크가 없다 — 매물 찾기 화면이 살아 있어도 아무도 닿을 수 없다',
    ).toHaveCount(1)

    await link.click()

    await expect(page).toHaveURL(/\/properties/)
    // 리다이렉트만 되고 에러 화면이면 의미가 없으므로 목적지 렌더까지 본다.
    await expect(page.getByRole('heading', { name: '매물 찾기' })).toBeVisible()
  })

  test('홈에서 클릭만으로 로그인·회원가입 동선에 닿는다 (DOW-1183)', async ({ page }) => {
    await page.goto('/')

    // `/signup`은 홈에 직접 링크가 없고 `/login` 안에서 이어진다. 그 2단 동선이
    // 살아 있는지 그대로 확인한다 — 직접 링크 유무가 아니라 닿는지가 기준이다.
    const login = page.locator('a[href="/login"]').first()
    await expect(login, '홈에 `/login` 진입 링크가 없다').toHaveCount(1)

    await login.click()
    await expect(page).toHaveURL(/\/login/)

    const signup = page.locator('a[href^="/signup"]').first()
    await expect(
      signup,
      '로그인 화면에 회원가입 링크가 없다 — 신규 사용자가 가입에 닿을 길이 없다',
    ).toHaveCount(1)

    await signup.click()
    await expect(page).toHaveURL(/\/signup/)
  })
})
