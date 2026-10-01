import {test,expect,type Browser,type Page,type Locator} from '@playwright/test'
const origin='http://127.0.0.1:3103'
test.skip(process.env.CONTRACT_TALK_REAL_E2E!=='1','격리 DB/기존 인증 로컬 전용')
async function login(browser:Browser,role:string,mobile=false){const context=await browser.newContext({timezoneId:'UTC',extraHTTPHeaders:{'x-forwarded-for':`127.${Math.floor(Date.now()/1000)%250}.1.${(mobile?10:0)+(['tenant','landlord','stranger'].indexOf(role)+1)}`},viewport:mobile?{width:393,height:851}:{width:1280,height:900}});const page=await context.newPage();const r=await context.request.post(`${origin}/api/auth/login`,{data:{email:`${role}@example.test`,password:'local-test-password-only'}});expect(r.status()).toBe(200);await page.goto(`${origin}/contract-talk`);return {context,page}}
async function mutate(page:Page,button:Locator){const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes('/api/contract-talk/')&&r.request().method()==='PATCH'),button.click()]);expect(r.status(),await r.text()).toBe(200)}
for(const mobile of [false,true])test(`실제 로그인·PostgreSQL 양측 흐름 ${mobile?'모바일':'데스크톱'}`,async({browser})=>{
 const tenant=await login(browser,'tenant',mobile),landlord=await login(browser,'landlord',mobile),stranger=await login(browser,'stranger')
 try{
  await tenant.page.getByLabel('상대 임대인의 입주해 계정 이메일').fill('landlord@example.test')
  await tenant.page.getByLabel('가능한 시간 1',{exact:true}).fill(new Date(Date.now()+86400000).toISOString().slice(0,16))
  await tenant.page.getByRole('button',{name:'요청 만들기',exact:true}).click();await expect(tenant.page.getByTestId('talk-stage')).toContainText('요청 생성')
  const privateUrl=tenant.page.url(),share=await tenant.page.getByLabel('공유 링크',{exact:true}).inputValue()
  await stranger.page.goto(share);await expect(stranger.page.locator('p[role="alert"]')).toContainText('접근할 수 없습니다')
  const anonymous=await browser.newContext();expect((await anonymous.request.get(share.replace('/contract-talk/','/api/contract-talk/'))).status()).toBe(401);await anonymous.close()
  await landlord.page.goto(share)
  for(let i=1;i<=3;i++)await landlord.page.getByLabel(`답변 ${i}`,{exact:true}).fill(`테스트 답변 ${i}`)
  await landlord.page.getByLabel('제안 시간',{exact:true}).fill(new Date(Date.now()+2*86400000).toISOString().slice(0,16))
  await mutate(landlord.page,landlord.page.getByRole('button',{name:'답변 저장',exact:true}));await expect(landlord.page.getByTestId('talk-stage')).toHaveText('상대 응답 있음')
  await tenant.page.reload();await mutate(tenant.page,tenant.page.getByRole('button',{name:'제안 시간에 합의',exact:true}))
  for(const who of [tenant,landlord]){await who.page.reload();for(let i=0;i<3;i++){const card=who.page.locator('article').nth(i);await mutate(who.page,card.getByRole('button',{name:'이 답변에 합의',exact:true}));await expect(card.getByRole('button',{name:'내 합의 철회',exact:true})).toBeVisible()}await mutate(who.page,who.page.getByRole('button',{name:'내 대화 완료',exact:true}))}
  for(const who of [tenant,landlord]){await who.page.reload();await mutate(who.page,who.page.getByRole('button',{name:'내 확인 완료',exact:true}))}
  await tenant.page.reload();await expect(tenant.page.getByTestId('talk-stage')).toHaveText('양측 확인 완료')
  await mutate(landlord.page,landlord.page.getByRole('button',{name:'정정 위해 대화 다시 열기',exact:true}));await expect(landlord.page.getByLabel('답변 1',{exact:true})).toBeVisible();await tenant.page.reload();await expect(tenant.page.getByTestId('talk-stage')).toHaveText('상대 응답 있음')
  await tenant.page.goto(privateUrl);tenant.page.on('dialog',d=>d.accept());await mutate(tenant.page,tenant.page.getByRole('button',{name:'요청 취소',exact:true}));await expect(tenant.page.getByTestId('talk-stage')).toHaveText('요청 취소됨')
  await landlord.page.reload();await expect(landlord.page.locator('p[role="alert"]')).toHaveText('취소된 요청입니다.')
  expect(await tenant.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 }finally{await tenant.context.close();await landlord.context.close();await stranger.context.close()}
})
