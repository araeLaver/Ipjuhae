const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3141'
;(async () => {
  const browser = await chromium.launch()
  try {
    const evidence = []
    for (const size of [
      { width: 390, height: 844 },
      { width: 1440, height: 1000 },
    ]) {
      const page = await browser.newPage({ viewport: size })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.route('**/api/analytics/event', (r) =>
        r.fulfill({ status: 200, json: { ok: true } }),
      )
      await page.goto(base, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: '최근 정책 소식' }).waitFor()
      const geometry = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
        newsY: Math.round(
          document.querySelector('#policy-news').getBoundingClientRect().top,
        ),
      }))
      assert(geometry.width <= size.width)
      assert(geometry.newsY < 850)
      assert.equal(await page.locator('#guides details').count(), 2)
      await page.locator('#guides summary').first().click()
      assert(
        (await page
          .locator('#guides details')
          .first()
          .getByRole('link')
          .count()) > 0,
      )
      await page.locator('#guides summary').first().click()
      if (size.width < 768) {
        await page.getByRole('button', { name: '메뉴 열기' }).click()
        await page
          .getByRole('navigation', { name: '모바일 메뉴' })
          .getByRole('link', { name: '정책소식', exact: true })
          .click()
      } else {
        await page
          .locator('header')
          .first()
          .getByRole('link', { name: '정책소식', exact: true })
          .click()
      }
      await page
        .getByRole('heading', { name: '주거 정책소식', exact: true })
        .waitFor()
      await page.getByRole('button', { name: '주택·청약' }).click()
      assert.equal(
        await page
          .getByRole('button', { name: '주택·청약' })
          .getAttribute('aria-pressed'),
        'true',
      )
      await page.getByRole('searchbox').fill('청약')
      await page.getByRole('heading', { name: /청약 예/ }).waitFor()
      await page.getByRole('searchbox').fill('없음-검증')
      await page.getByText('검색 조건에 맞는 소식이 없습니다.').waitFor()
      await page.getByRole('button', { name: '전체', exact: true }).click()
      await page.getByRole('searchbox').fill('')
      await page.getByRole('button', { name: '최신 수집 결과 보기' }).click()
      await page.getByRole('button', { name: '최신 수집 결과 보기' }).waitFor()
      assert((await page.locator('#policy-news li').count()) >= 10)
      await page.route('**/api/policy-news', (r) => r.abort())
      await page.getByRole('button', { name: '최신 수집 결과 보기' }).click()
      await page
        .getByText('화면을 갱신하지 못했습니다. 저장된 소식을 보여드립니다.')
        .waitFor()
      assert((await page.locator('#policy-news li').count()) >= 10)
      await page.unroute('**/api/policy-news')
      await page.goto(base)
      await page.getByRole('link', { name: /저장한 후보 이어보기/ }).waitFor()
      await page.getByRole('link', { name: /내 질문 답변 확인/ }).waitFor()
      await page.screenshot({
        path: '/private/tmp/ipjuhae-home-policy-after-' + size.width + '.png',
        fullPage: true,
      })
      assert.equal(errors.length, 0, errors.join(' | '))
      await page
        .getByRole('navigation', { name: '바로 시작하기' })
        .getByRole('link', { name: /후보 집 비교/ })
        .click()
      await page.getByRole('heading', { name: '후보 집 저장·비교' }).waitFor()
      assert(page.url().endsWith('/check#candidates'))
      await page.goto(base)
      await page.evaluate(() => {
        localStorage.setItem(
          'ipjuhae.check-candidates.v1',
          JSON.stringify({
            version: 1,
            items: [
              {
                id: 'qa-home',
                label: '개인 검증 후보',
                savedAt: new Date().toISOString(),
                input: {
                  marketPriceManwon: 40000,
                  depositManwon: 30000,
                  mortgageMaxManwon: 0,
                  priorDepositsManwon: 0,
                },
                checked: [true, false, false, false],
              },
            ],
          }),
        )
        localStorage.setItem(
          'ipjuhae.community.questions.v1',
          JSON.stringify(['11111111-1111-4111-8111-111111111111']),
        )
      })
      await page.reload()
      await page
        .getByRole('link', { name: /내 후보 1개 · 남은 확인 3개/ })
        .waitFor()
      await page
        .getByRole('link', { name: /보관한 질문 1개 · 답변 확인/ })
        .waitFor()
      assert(
        !/개인 검증 후보|40000|30000/.test(
          await page
            .getByRole('navigation', { name: '내 계약 준비 이어보기' })
            .innerText(),
        ),
      )
      await page
        .getByRole('link', { name: /보관한 질문 1개 · 답변 확인/ })
        .click()
      await page
        .getByRole('heading', { name: '이 기기에 보관한 질문' })
        .waitFor()
      assert(page.url().endsWith('/community#follow-up'))
      evidence.push({
        returnProgress: true,
        returnQuestionLink: true,
        viewport: size,
        ...geometry,
        menu: true,
        filterSearch: true,
        refresh: true,
        offlinePreservesStories: true,
        guidesExpandable: true,
        candidateLink: true,
        jsErrors: errors.length,
      })
      await page.close()
    }
    console.log(JSON.stringify({ result: 'pass', evidence }, null, 2))
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
