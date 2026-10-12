const { chromium } = require('@playwright/test')
const jwt = require('jsonwebtoken')
const fs = require('node:fs/promises')
const assert = require('node:assert/strict')
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3142'
;(async () => {
  const browser = await chromium.launch()
  const evidence = []
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 1000 },
    ]) {
      const context = await browser.newContext({
        viewport,
        acceptDownloads: true,
      })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.route('**/api/analytics/event', (r) =>
        r.fulfill({ status: 200, json: { ok: true } }),
      )
      await page.goto(base + '/check')
      await page.getByLabel('매매 시세').fill('40000')
      await page.getByLabel('내 보증금').fill('30000')
      await page.getByRole('button', { name: '확인하기', exact: true }).click()
      await page.getByLabel('후보 별칭 (선택)').fill('검증 후보 A')
      await page
        .getByRole('button', { name: '현재 결과를 후보로 저장' })
        .click()
      await page
        .getByRole('checkbox', { name: '최신 등기부를 직접 확인했어요' })
        .check()
      await page.getByLabel('매매 시세').fill('38000')
      await page.getByRole('button', { name: '확인하기', exact: true }).click()
      await page.getByLabel('후보 별칭 (선택)').fill('검증 후보 B')
      await page
        .getByRole('button', { name: '현재 결과를 후보로 저장' })
        .click()
      let promise = page.waitForEvent('download')
      await page.getByRole('button', { name: '준비 기록 내려받기' }).click()
      const summary = await promise
      const text = await fs.readFile(await summary.path(), 'utf8')
      assert(text.includes('검증 후보 A'))
      assert(text.includes('[남은 확인]'))
      assert(text.includes('[본인 확인]'))
      promise = page.waitForEvent('download')
      await page.getByRole('button', { name: '후보 백업 내려받기' }).click()
      const backup = await promise
      const backupPath = await backup.path()
      const original = await fs.readFile(backupPath, 'utf8')
      assert.equal(JSON.parse(original).items.length, 2)
      await page.evaluate(() =>
        localStorage.removeItem('ipjuhae.check-candidates.v1'),
      )
      await page.reload()
      await page.getByText('아직 저장한 후보가 없습니다.').waitFor()
      await page.getByLabel('후보 백업 파일 선택').setInputFiles(backupPath)
      await page
        .getByRole('button', { name: '기존 후보를 교체하고 복원' })
        .waitFor()
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem('ipjuhae.check-candidates.v1'),
        ),
        null,
      )
      await page
        .getByRole('button', { name: '기존 후보를 교체하고 복원' })
        .click()
      await page.getByRole('heading', { name: '검증 후보 A' }).waitFor()
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem('ipjuhae.check-candidates.v1'),
        ),
        original,
      )
      await page.getByLabel('후보 백업 파일 선택').setInputFiles({
        name: 'bad.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{bad'),
      })
      await page
        .getByText(
          '복원할 수 없는 백업 파일입니다. 기존 후보는 변경하지 않았습니다.',
        )
        .waitFor()
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem('ipjuhae.check-candidates.v1'),
        ),
        original,
      )
      await page.goto(base + '/service')
      await page
        .getByRole('heading', { name: '개인 계약 준비 도구 · 무료' })
        .waitFor()
      await page.getByRole('link', { name: '무료로 계약 준비 시작' }).waitFor()
      assert(
        await page
          .getByRole('link', {
            name: 'ipjuhae.official@gmail.com',
            exact: true,
          })
          .count(),
      )
      await page.screenshot({
        path:
          '/private/tmp/ipjuhae-operating-service-' + viewport.width + '.png',
        fullPage: true,
      })
      let authenticatedQA = false
      if (new URL(base).hostname === '127.0.0.1') {
        assert.equal(
          (await context.request.get(base + '/api/admin/stats/today')).status(),
          403,
        )
        const token = (role) =>
          jwt.sign(
            {
              userId:
                role === 'admin'
                  ? '33333333-3333-4333-8333-333333333333'
                  : '22222222-2222-4222-8222-222222222222',
              userType: role,
              tokenType: 'access',
            },
            'qa-local-only-operating-service',
            {
              algorithm: 'HS256',
              expiresIn: '1h',
              audience: 'rentme-api',
              issuer: 'rentme',
            },
          )
        await context.addCookies([
          { name: 'auth_token', value: token('landlord'), url: base },
        ])
        await page.goto(base + '/landlord/subscription?success=true')
        await page
          .getByText('결제 확인 정보가 없습니다. 결제 내역을 확인해주세요.')
          .waitFor()
        await page
          .getByRole('heading', { name: '매물 관리 이용 플랜' })
          .waitFor()
        await page.getByText('현재 플랜: 무료').waitFor()
        assert(
          await page
            .getByRole('button', { name: '유료 결제 준비 중' })
            .first()
            .isDisabled(),
        )
        assert.equal(
          (await context.request.get(base + '/api/admin/stats/today')).status(),
          403,
        )
        await page.screenshot({
          path:
            '/private/tmp/ipjuhae-operating-billing-' + viewport.width + '.png',
          fullPage: true,
        })
        await context.addCookies([
          { name: 'auth_token', value: token('admin'), url: base },
        ])
        await page.goto(base + '/admin/operations')
        await page.getByRole('heading', { name: '서비스 운영·수익' }).waitFor()
        await page.getByText(/유료 결제 연결 미완료/).waitFor()
        assert.equal(await page.getByText(/질문 현황 조회 실패/).count(), 0)
        await page.getByText(/답변 대기 1건 · 24시간 이상 1건/).waitFor()
        await page
          .getByText(
            '이번 달 결제 완료액을 확인하지 못했습니다. 결제 업체 연결과 내역을 확인하세요.',
          )
          .waitFor()
        assert.equal(
          (await context.request.get(base + '/api/admin/stats/today')).status(),
          200,
        )
        await page.screenshot({
          path:
            '/private/tmp/ipjuhae-operating-admin-' + viewport.width + '.png',
          fullPage: true,
        })
        assert(
          (await page.evaluate(() => document.documentElement.scrollWidth)) <=
            viewport.width,
        )
        await page.goto(base + '/admin/inquiries')
        await page.getByRole('heading', { name: '신청·고객 의견' }).waitFor()
        await page
          .getByRole('heading', { name: '세입자 · qa-subscriber@example.test' })
          .waitFor()
        await page.getByText('합성 이용 의견: 후보를 옮겨보고 싶어요').waitFor()
        assert.equal(
          await page.getByRole('link', { name: '안내 메일 작성' }).count(),
          1,
        )
        assert(
          (await page.evaluate(() => document.documentElement.scrollWidth)) <=
            viewport.width,
        )
        await page.screenshot({
          path:
            '/private/tmp/ipjuhae-operating-inquiries-' +
            viewport.width +
            '.png',
          fullPage: true,
        })
        authenticatedQA = true
      }
      assert.equal(errors.length, 0, errors.join(' | '))
      evidence.push({
        viewport,
        summaryDownload: true,
        backupRoundTrip: true,
        confirmBeforeReplacement: true,
        corruptBackupPreservesData: true,
        publicServiceAndContact: true,
        authenticatedQA,
        jsErrors: errors.length,
      })
      await context.close()
    }
    console.log(JSON.stringify({ result: 'pass', base, evidence }, null, 2))
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
