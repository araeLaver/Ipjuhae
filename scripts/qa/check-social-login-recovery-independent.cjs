const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
;(async () => {
 const base = 'http://localhost:3197'
 const browser = await chromium.launch({headless:true})
 const results=[]
 try {
  for (const mode of ['login','signup']) {
   const page=await browser.newPage({viewport:{width:360,height:800},extraHTTPHeaders:{'x-forwarded-for':mode==='login'?'192.0.2.11':'192.0.2.12'}}); page.setDefaultTimeout(10000)
   let lists=0
   await page.route('**/api/auth/providers',r=>r.fulfill({json:{providers:lists++ === 0 ? ['kakao'] : []}}))
   await page.goto(`${base}/${mode}?redirect=${encodeURIComponent('/community/abc?tab=latest')}`); await page.waitForLoadState('load')
   await page.getByRole('button',{name:mode==='login'?'카카오로 로그인':'카카오로 가입',exact:true}).click()
   const status=page.getByRole('status').filter({hasText:'소셜 로그인을 사용할 수 없습니다'})
   await status.waitFor().catch(async e=>{ console.log(mode, page.url(), (await page.locator('body').innerText()).slice(0,2000)); throw e }); await page.waitForLoadState('load')
   assert.equal(new URL(page.url()).pathname,'/login')
   await page.waitForFunction(()=>!document.body.textContent.includes('카카오로 로그인'))
   assert.equal(await page.locator('#email').count(),1)
   const recovery=page.getByRole('button',{name:'이메일로 로그인',exact:true})
   await recovery.focus(); await page.keyboard.press('Enter')
   await page.waitForFunction(()=>document.activeElement===document.querySelector('#email'))
   assert(await status.textContent().then(t=>t.includes('이메일과 비밀번호로 가입한 계정이 없다면')))
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   // Chromium CSS zoom 검사. 실제 스크린리더 음성 출력은 별도 수동 검수 대상이다.
   await page.setViewportSize({width:720,height:900}); await page.evaluate(()=>document.documentElement.style.zoom='2')
   await recovery.scrollIntoViewIfNeeded(); await recovery.focus(); await page.keyboard.press('Enter')
   await page.waitForFunction(()=>document.activeElement===document.querySelector('#email'))
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   await page.screenshot({path:`docs/qa/social-login-recovery-independent-20261012/${mode}-zoom200.png`,fullPage:true})
   results.push({시나리오:`${mode} 목록 노출 후 시작 차단`,판정:'PASS',이메일포커스:true,확대:'CSS zoom 200%',목적지:new URL(page.url()).searchParams.get('redirect')})
   await page.close()
  }
  const page=await browser.newPage({extraHTTPHeaders:{'x-forwarded-for':'192.0.2.13'}}); page.setDefaultTimeout(10000)
  await page.route('**/api/auth/providers',r=>r.fulfill({json:{providers:[]}}))
  for (const redirect of ['https://evil.example','//evil.example','/\\evil.example','/bad\npath']) {
   await page.goto(`${base}/api/auth/social/kakao?redirect=${encodeURIComponent(redirect)}`)
   await page.waitForLoadState('load'); assert.equal(new URL(page.url()).searchParams.get('error'),'oauth_unavailable')
   assert.equal(new URL(page.url()).origin,base)
   assert.equal(new URL(page.url()).searchParams.has('redirect'),false)
  }
  results.push({시나리오:'위험한 목적지 4종 브라우저 복구',판정:'PASS'})
  const limited=await browser.newPage({extraHTTPHeaders:{'fly-client-ip':'192.0.2.151'}})
  for (let i=0;i<10;i++) {
   const response=await limited.request.get(`${base}/api/auth/providers`)
   assert.equal(response.status(),200)
  }
  const api=await limited.request.get(`${base}/api/auth/social/kakao`,{headers:{Accept:'application/json'}})
  assert.equal(api.status(),429); assert.equal((await api.json()).code,'RATE_LIMIT_EXCEEDED')
  assert(Number(api.headers()['retry-after'])>0)
  const blocked=await limited.goto(`${base}/api/auth/social/kakao?redirect=${encodeURIComponent('/community/abc?tab=latest')}`)
  assert.equal(new URL(limited.url()).pathname,'/login')
  assert.equal(new URL(limited.url()).searchParams.get('error'),'oauth_unavailable')
  assert.equal(new URL(limited.url()).searchParams.get('redirect'),'/community/abc?tab=latest')
  await limited.getByRole('status').filter({hasText:'소셜 로그인을 사용할 수 없습니다'}).waitFor()
  await limited.getByRole('button',{name:'이메일로 로그인',exact:true}).click()
  await limited.waitForFunction(()=>document.activeElement===document.querySelector('#email'))
  assert.equal(blocked.status(),200)
  await limited.screenshot({path:'docs/qa/social-login-recovery-independent-20261012/rate-limit-recovery.png',fullPage:true})
  results.push({시나리오:'인증 10회 소진 후 API 429 유지 및 브라우저 지속 안내 복구',판정:'PASS',목적지:new URL(limited.url()).searchParams.get('redirect')})
  await limited.close()
  fs.writeFileSync('docs/qa/social-login-recovery-independent-20261012/browser-result.json',JSON.stringify(results,null,2)+'\n')
  console.log(JSON.stringify(results,null,2))
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
