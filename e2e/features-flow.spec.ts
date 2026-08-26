// 커뮤니티(글/댓글), 메시지(전송/양방향 조회), 관심목록(집주인→세입자) 핵심 쓰기 플로우 회귀 테스트.
// 격리 DB에서만 실행. 2026-08-26 발견 버그(관심목록 INNER JOIN으로 목록 누락) 커버.
import { test, expect } from './fixtures'
test.skip(!process.env.PLAYWRIGHT_DATABASE_URL, 'needs test DB')
test.setTimeout(150000)
const TERMS = /이용약관.*동의합니다/, PRIVACY = /개인정보처리방침.*동의합니다/, PW = 'feataudit01234'
function ip(){const o=()=>1+Math.floor(Math.random()*253);return `10.${o()}.${o()}.${o()}`}
async function su(page:any, mail:string, role:'tenant'|'landlord'){
  await page.context().setExtraHTTPHeaders({'x-forwarded-for':ip()})
  await page.goto('/signup'); await page.locator('#email').fill(mail); await page.locator('#password').fill(PW); await page.locator('#confirmPassword').fill(PW)
  if(role==='landlord') await page.locator('label[for="landlord"]').click()
  await page.getByRole('checkbox',{name:TERMS}).check(); await page.getByRole('checkbox',{name:PRIVACY}).check()
  await Promise.all([page.waitForURL((u:URL)=>!u.pathname.startsWith('/signup')), page.getByRole('button',{name:'가입하기'}).click()])
}
async function uid(page:any){ return (await (await page.request.get('/api/auth/me')).json()).user?.id }

test('커뮤니티: 글 작성 → 조회 → 댓글', async ({ page }) => {
  await su(page, `com_${Date.now()}@example.com`, 'tenant')
  const create = await page.request.post('/api/community/posts', { data: { audience:'all', title:'E2E 커뮤니티 글', body:'검증용 본문입니다.' } })
  console.log('POST_CREATE', create.status())
  expect(create.ok()).toBeTruthy()
  const post = await create.json()
  const postId = post.id || post.post?.id || post.data?.id
  console.log('POST_ID', postId); expect(postId).toBeTruthy()
  const get = await page.request.get(`/api/community/posts/${postId}`)
  console.log('POST_GET', get.status()); expect(get.ok()).toBeTruthy()
  const comment = await page.request.post(`/api/community/posts/${postId}/comments`, { data: { body:'검증 댓글입니다.' } })
  console.log('COMMENT_POST', comment.status()); expect(comment.ok()).toBeTruthy()
  const comments = await (await page.request.get(`/api/community/posts/${postId}/comments`)).json()
  const carr = Array.isArray(comments)?comments:(comments.comments||comments.data||[])
  console.log('COMMENT_COUNT', carr.length); expect(carr.length).toBeGreaterThan(0)
})

test('메시지: 대화 생성 → 메시지 전송 → 상대가 읽음', async ({ page, browser }) => {
  await su(page, `msL_${Date.now()}@example.com`, 'landlord')
  const landlordId = await uid(page)
  const tctx = await browser.newContext(); const tp = await tctx.newPage()
  await su(tp, `msT_${Date.now()}@example.com`, 'tenant')
  // 세입자가 대화 시작
  const conv = await tp.request.post('/api/messages/conversations', { data: { targetUserId: landlordId, initialMessage:'문의드립니다' } })
  expect(conv.ok()).toBeTruthy()
  const convId = (await conv.json()).conversationId
  console.log('CONV_ID', convId)
  // 집주인이 답장
  const reply = await page.request.post(`/api/messages/conversations/${convId}`, { data: { content:'네 안녕하세요, 답변드립니다' } })
  console.log('REPLY_POST', reply.status()); expect(reply.ok()).toBeTruthy()
  // 세입자가 대화 메시지 조회 → 2개(문의+답장)
  const msgs = await (await tp.request.get(`/api/messages/conversations/${convId}`)).json()
  const marr = Array.isArray(msgs)?msgs:(msgs.messages||msgs.data||[])
  console.log('MESSAGE_COUNT', marr.length); expect(marr.length).toBeGreaterThanOrEqual(2)
  await tctx.close()
})

test('관심목록: 집주인이 세입자 즐겨찾기', async ({ page, browser }) => {
  const tctx = await browser.newContext(); const tp = await tctx.newPage()
  await su(tp, `favT_${Date.now()}@example.com`, 'tenant')
  const tenantId = await uid(tp)
  await su(page, `favL_${Date.now()}@example.com`, 'landlord')
  const add = await page.request.post('/api/favorites', { data: { tenantId, note:'관심 세입자' } })
  console.log('FAV_ADD', add.status()); expect(add.ok()).toBeTruthy()
  const list = await (await page.request.get('/api/favorites')).json()
  const farr = Array.isArray(list)?list:(list.favorites||list.data||list.tenants||[])
  console.log('FAV_COUNT', farr.length); expect(farr.length).toBeGreaterThan(0)
  await tctx.close()
})
