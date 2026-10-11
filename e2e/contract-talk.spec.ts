import { test, expect, type Browser, type Page } from '@playwright/test'
test.skip(process.env.CONTRACT_TALK_LOCAL_E2E !== '1', '로컬 합성 계정 서버에서만 실행합니다.')
const origin='http://127.0.0.1:3104'
const header={Origin:origin,'X-Local-Fixture':'1'}
async function actor(browser:Browser,role:string) {
 const context=await browser.newContext({timezoneId:'UTC'})
 const page=await context.newPage()
 await page.goto(`${origin}/__local/login/${role}`)
 return {context,page}
}
async function create(page:Page) {
 await page.getByLabel('상대 임대인의 입주해 계정 이메일').fill('landlord@example.test')
 await page.getByLabel('가능한 시간 1', {exact:true}).fill(new Date(Date.now()+2*86400000).toISOString().slice(0,16))
 await page.getByRole('button',{name:'요청 만들기',exact:true}).click()
 await expect(page.getByTestId('talk-stage')).toHaveText('요청 생성 · 상대 응답 대기')
 return {url:page.url(),share:await page.getByLabel('공유 링크',{exact:true}).inputValue()}
}
async function response(page:Page,share:string) {
 await page.goto(share)
 for(let i=1;i<=3;i++) await page.getByLabel(`답변 ${i}`,{exact:true}).fill(['앱 메시지로 이야기합니다.','다음 주 가능합니다.','수리할 부분을 함께 확인합니다.'][i-1])
 await page.getByRole('button',{name:'답변 저장',exact:true}).click()
 await expect(page.getByTestId('talk-stage')).toHaveText('상대 응답 있음')
}

async function agreeAll(page:Page) {
 for(let i=0;i<3;i++){const card=page.locator('article').nth(i);await card.getByRole('button',{name:'이 답변에 합의',exact:true}).click();await expect(card.getByRole('button',{name:'내 합의 철회',exact:true})).toBeVisible()}
}
test.beforeEach(async({request})=>{await request.post(`${origin}/__local/reset`,{headers:header})})
test('임차인 생성→임대인 응답→합의·추가 확인→양측 대화/확인 완료',async({browser})=>{
 const tenant=await actor(browser,'tenant'),landlord=await actor(browser,'landlord')
 try {
  const r=await create(tenant.page);await response(landlord.page,r.share)
  await tenant.page.getByRole('button',{name:'최신 내용 확인',exact:true}).click()
  await expect(tenant.page.getByTestId('talk-stage')).toHaveText('상대 응답 있음')
  await agreeAll(tenant.page);await landlord.page.reload();await agreeAll(landlord.page)
  const last=landlord.page.locator('article').nth(2)
  await last.getByRole('button',{name:'추가 확인 필요 표시',exact:true}).click()
  await expect(last.getByTestId('category-2')).toHaveText('추가 확인 필요')
  await landlord.page.getByRole('button',{name:'내 대화 완료',exact:true}).click()
  await tenant.page.reload();await tenant.page.getByRole('button',{name:'내 대화 완료',exact:true}).click()
  await expect(tenant.page.getByTestId('talk-stage')).toHaveText('양측 대화 완료')
  await expect(tenant.page.getByRole('button',{name:'내 확인 완료',exact:true})).toBeDisabled()
  await landlord.page.reload();await last.getByRole('button',{name:'내 추가 확인 해소',exact:true}).click()
  await tenant.page.reload();await tenant.page.getByRole('button',{name:'내 확인 완료',exact:true}).click()
  await expect(tenant.page.getByTestId('talk-stage')).toHaveText('양측 대화 완료')
  await landlord.page.reload();await landlord.page.getByRole('button',{name:'내 확인 완료',exact:true}).click()
  await expect(landlord.page.getByTestId('talk-stage')).toHaveText('양측 확인 완료')
  await tenant.page.reload();await expect(tenant.page.getByTestId('talk-stage')).toHaveText('양측 확인 완료')
  await tenant.page.screenshot({path:'../evidence/contract-talk-completed.png',fullPage:true})
 }finally{await tenant.context.close();await landlord.context.close()}
})
test('뒤로가기/반복 생성과 응답 전 수정·취소·잘못된 링크',async({browser})=>{
 const t=await actor(browser,'tenant'),l=await actor(browser,'landlord')
 try{
  const r=await create(t.page)
  await t.page.goBack();await t.page.getByRole('button',{name:'요청 만들기',exact:true}).click();await expect(t.page).toHaveURL(r.url)
  await t.page.getByText('응답 전 일정 수정',{exact:true}).click()
  await t.page.getByLabel('수정 시간 1',{exact:true}).fill(new Date(Date.now()+3*86400000).toISOString().slice(0,16))
  await t.page.getByRole('button',{name:'일정 저장',exact:true}).click();await expect(t.page.getByTestId('talk-stage')).toHaveText('요청 생성 · 상대 응답 대기')
  t.page.on('dialog',dialog=>dialog.accept())
  await t.page.getByRole('button',{name:'요청 취소',exact:true}).click();await expect(t.page.getByTestId('talk-stage')).toHaveText('요청 취소됨')
  await l.page.goto(r.share);await expect(l.page.locator('p[role="alert"]')).toContainText('취소된 요청')
  await l.page.goto(`${origin}/contract-talk/shared/not-a-valid-link`);await expect(l.page.locator('p[role="alert"]')).toContainText('잘못된 요청 링크')
 }finally{await t.context.close();await l.context.close()}
})
test('일정만 제안하고 합의하며 만료된 링크와 요청은 수정하지 못한다',async({browser,request})=>{
 const t=await actor(browser,'tenant'),l=await actor(browser,'landlord')
 try{
  const r=await create(t.page);await l.page.goto(r.share)
  await l.page.getByLabel('제안 시간',{exact:true}).fill(new Date(Date.now()+2*86400000).toISOString().slice(0,16))
  await l.page.getByRole('button',{name:'답변 저장',exact:true}).click();await expect(l.page.getByTestId('talk-stage')).toHaveText('상대 응답 있음')
  await t.page.reload();await t.page.getByRole('button',{name:'제안 시간에 합의',exact:true}).click();await expect(t.page.getByText('양측 일정 합의',{exact:true})).toBeVisible()
  await request.post(`${origin}/__local/advance`,{headers:header})
  await l.page.reload();await expect(l.page.locator('p[role="alert"]')).toContainText('만료된 요청')
  await t.page.reload();await expect(t.page.getByTestId('talk-stage')).toHaveText('요청 만료됨');await expect(t.page.getByRole('button',{name:'요청 취소',exact:true})).toHaveCount(0)
 }finally{await t.context.close();await l.context.close();await request.post(`${origin}/__local/reset`,{headers:header})}
})
test('첫 응답 후 제3자/비로그인·다른 Origin·오래된 version을 거부한다',async({browser})=>{
 const t=await actor(browser,'tenant'),l=await actor(browser,'landlord'),s=await actor(browser,'stranger'),anon=await browser.newContext()
 try{
  const r=await create(t.page);await response(l.page,r.share)
  await s.page.goto(r.share);await expect(s.page.locator('p[role="alert"]')).toContainText('접근할 수 없습니다')
  const api=`${origin}/api/contract-talk/shared/${r.share.split('/').pop()}`
  expect((await anon.request.get(api)).status()).toBe(401)
  const current=await l.context.request.get(api);const {talk}=await current.json()
  const change={version:talk.version,change:{action:'accept',index:0,value:true}}
  expect((await l.context.request.patch(api,{headers:{Origin:'http://elsewhere'},data:change})).status()).toBe(403)
  const repeated=await Promise.all([l.context.request.patch(api,{headers:header,data:change}),l.context.request.patch(api,{headers:header,data:change})])
  expect(repeated.map(r=>r.status()).sort()).toEqual([200,409])
 }finally{await t.context.close();await l.context.close();await s.context.close();await anon.close()}
})
test('모바일 양측 화면에서 요청 생성과 응답을 확인한다',async({browser})=>{
 const t=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,timezoneId:'UTC'}),l=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,timezoneId:'UTC'})
 try{
  const tp=await t.newPage(),lp=await l.newPage();await tp.goto(`${origin}/__local/login/tenant`);const r=await create(tp)
  await lp.goto(`${origin}/__local/login/landlord`);await response(lp,r.share);await tp.reload();await expect(tp.getByTestId('talk-stage')).toHaveText('상대 응답 있음')
  await tp.screenshot({path:'../evidence/contract-talk-mobile-owner.png',fullPage:true});await lp.screenshot({path:'../evidence/contract-talk-mobile-landlord.png',fullPage:true})
  expect(await tp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 }finally{await t.close();await l.close()}
})

test('첫 방문 모바일 가입·로그인 복귀와 실패 안내', async ({browser}) => {
 const context=await browser.newContext({viewport:{width:393,height:851}})
 const page=await context.newPage()
 try {
  await page.goto('/contract-talk')
  await page.getByRole('link',{name:'로그인',exact:true}).click()
  await page.getByRole('link',{name:'회원가입',exact:true}).first().click()
  await expect(page).toHaveURL(/signup\?redirect=%2Fcontract-talk$/)
  await expect(page.getByText('가입 후 원래 대화 요청 화면으로 돌아갑니다.',{exact:false})).toBeVisible()
  await page.route('**/api/auth/signup',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}))
  await page.getByLabel('이메일',{exact:true}).fill('synthetic@example.test')
  await page.getByLabel('비밀번호',{exact:true}).fill('synthetic-password')
  await page.getByLabel('비밀번호 확인',{exact:true}).fill('synthetic-password')
  await page.getByRole('checkbox').nth(1).check()
  await page.getByRole('checkbox').nth(2).check()
  await page.getByRole('button',{name:'가입하기',exact:true}).click()
  await expect(page).toHaveURL(/\/contract-talk$/)
  await page.goto('/contract-talk/shared/synthetic-missing-token')
  await expect(page.locator('p[role="alert"]')).toBeVisible()
  await expect(page.getByRole('textbox',{name:'원하는 기능'})).toBeVisible()
  await page.getByRole('link',{name:'임대인 계정 가입 후 이 요청으로 돌아오기'}).click()
  await expect(page).toHaveURL(/redirect=%2Fcontract-talk%2Fshared%2Fsynthetic-missing-token/)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 } finally {await context.close()}
})

test('로그인 복귀·허용하지 않는 가입 복귀 URL·이미 로그인한 복귀',async({browser})=>{
 const context=await browser.newContext(),page=await context.newPage()
 try {
  await page.goto('/login?redirect=%2Fcontract-talk%2Frequests')
  await page.route('**/api/auth/login',route=>route.fulfill({status:200,contentType:'application/json',body:'{"user":{"user_type":"tenant"}}'}))
  await page.getByLabel('이메일',{exact:true}).fill('synthetic@example.test')
  await page.getByLabel('비밀번호',{exact:true}).fill('synthetic-password')
  await page.getByRole('button',{name:'로그인',exact:true}).click()
  await expect(page).toHaveURL(/\/contract-talk\/requests$/)
  await expect(page.getByRole('link',{name:'로그인하고 목록으로 돌아오기'})).toBeVisible()
  for(const redirect of ['//evil.test','/contract-talk/../login','/contract-talk/%2f%2fevil.test']) {
   await page.goto(`/signup?redirect=${encodeURIComponent(redirect)}`)
   await expect(page.getByText('입주해에 가입하고 프로필을 만들어보세요')).toBeVisible()
   await expect(page.getByRole('link',{name:'로그인',exact:true}).last()).toHaveAttribute('href','/login')
  }
  await page.goto('/__local/login/tenant')
  await page.goto('/login?redirect=%2Fcontract-talk%2Frequests')
  await expect(page).toHaveURL(/\/contract-talk\/requests$/)
 } finally {await context.close()}
})
