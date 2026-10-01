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
  const [created]=await Promise.all([tenant.page.waitForResponse(r=>r.url().endsWith('/api/contract-talk')&&r.request().method()==='POST'),tenant.page.getByRole('button',{name:'요청 만들기',exact:true}).click()]);expect(created.status(),await created.text()).toBe(201);await expect(tenant.page.getByTestId('talk-stage')).toContainText('요청 생성',{timeout:15000})
  const privateUrl=tenant.page.url(),share=await tenant.page.getByLabel('공유 링크',{exact:true}).inputValue()
  await tenant.page.getByRole('link',{name:'보낸·받은 요청 보기',exact:true}).click();await expect(tenant.page.getByRole('link',{name:/보낸 요청/}).first()).toHaveAttribute('href',new URL(privateUrl).pathname);await tenant.page.goto(privateUrl)
  await landlord.page.goto(`${origin}/contract-talk/requests`);await expect(landlord.page.getByRole('link',{name:/받은 요청/}).first()).toHaveAttribute('href',new URL(share).pathname)
  await stranger.page.goto(`${origin}/contract-talk/requests`);await expect(stranger.page.getByText('아직 보낸·받은 요청이 없습니다.')).toBeVisible()
  await stranger.page.goto(share);await expect(stranger.page.locator('p[role="alert"]')).toContainText('접근할 수 없습니다')
  const anonymous=await browser.newContext();expect((await anonymous.request.get(share.replace('/contract-talk/','/api/contract-talk/'))).status()).toBe(401);await anonymous.close()
  await landlord.page.goto(share)
  for(let i=1;i<=3;i++)await landlord.page.getByLabel(`답변 ${i}`,{exact:true}).fill(`테스트 답변 ${i}`)
  await landlord.page.getByLabel('제안 시간',{exact:true}).fill(new Date(Date.now()+2*86400000).toISOString().slice(0,16))
  await mutate(landlord.page,landlord.page.getByRole('button',{name:'답변 저장',exact:true}));await expect(landlord.page.getByTestId('talk-stage')).toHaveText('상대 응답 있음')
  await landlord.page.goto(`${origin}/contract-talk/requests`);await expect(landlord.page.getByRole('link',{name:/받은 요청/}).first()).toHaveAttribute('href',new URL(privateUrl).pathname);await landlord.page.goto(privateUrl)
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

test('실제 native Bearer 인증·중복·익명 집계·피드백·로그인 복귀',async({browser})=>{
 const c=await browser.newContext({extraHTTPHeaders:{'x-mobile-client':'true','x-forwarded-for':'127.92.4.1'}});
 const login=await c.request.post(`${origin}/api/auth/login`,{data:{email:'tenant@example.test',password:'local-test-password-only'}});expect(login.status()).toBe(200);const token=(await login.json()).token;
 await c.clearCookies();const headers={Authorization:`Bearer ${token}`};const input={recipientEmail:'landlord@example.test',clientKey:crypto.randomUUID(),slots:[new Date(Date.now()+86400000).toISOString()]};
 const a=await c.request.post(`${origin}/api/contract-talk`,{headers,data:input});expect(a.status()).toBe(201);const t=(await a.json()).talk;
 const b=await c.request.post(`${origin}/api/contract-talk`,{headers,data:input});expect(b.status()).toBe(201);expect((await b.json()).talk.id).toBe(t.id);
 const list=await c.request.get(`${origin}/api/contract-talk`,{headers});expect(list.status()).toBe(200);expect((await list.json()).requests.some((r:any)=>r.id===t.id)).toBe(true);
 expect((await c.request.post(`${origin}/api/contract-talk`,{headers:{Authorization:'Bearer invalid'},data:input})).status()).toBe(401);
 expect((await c.request.post(`${origin}/api/contract-talk`,{headers:{...headers,Origin:'https://evil.example.test'},data:input})).status()).toBe(403);
 expect((await c.request.post(`${origin}/api/analytics/event`,{data:{event_name:'contract_talk_created',properties:{surface:'app'}}})).status()).toBe(400);
 const page=await c.newPage();await page.goto(`${origin}/contract-talk/requests`);await page.getByRole('link',{name:'로그인하고 목록으로 돌아오기'}).click();await expect(page).toHaveURL(/redirect=%2Fcontract-talk%2Frequests/);
 await c.request.post(`${origin}/api/auth/login`,{data:{email:'tenant@example.test',password:'local-test-password-only'}});await page.goto(`${origin}/contract-talk/requests`);
 await expect(page.getByLabel('연락처 (선택)')).toHaveCount(0);await page.getByLabel('원하는 기능').fill('QA synthetic: refresh retry clarity');
 const [r]=await Promise.all([page.waitForRequest(r=>r.url().endsWith('/api/feature-requests')&&r.method()==='POST'),page.getByRole('button',{name:'의견 보내기'}).click()]);expect(r.postDataJSON()).toEqual({message:'QA synthetic: refresh retry clarity',source:'contract-talk'});await expect(page.getByText('의견이 접수됐어요')).toBeVisible();
 await c.close();
})
