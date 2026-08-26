// 레퍼런스 핵심 트러스트 플로우: 세입자 요청 → 참조인 설문 조회/제출 → 완료 반영.
// 격리 DB에서만 실행.
import { test, expect } from './fixtures'
test.skip(!process.env.PLAYWRIGHT_DATABASE_URL, 'needs test DB')
test.setTimeout(120000)
const TERMS = /이용약관.*동의합니다/, PRIVACY = /개인정보처리방침.*동의합니다/, PW = 'refaudit01234'
function ip(){const o=()=>1+Math.floor(Math.random()*253);return `10.${o()}.${o()}.${o()}`}
async function su(page:any, mail:string){
  await page.context().setExtraHTTPHeaders({'x-forwarded-for':ip()})
  await page.goto('/signup'); await page.locator('#email').fill(mail); await page.locator('#password').fill(PW); await page.locator('#confirmPassword').fill(PW)
  await page.getByRole('checkbox',{name:TERMS}).check(); await page.getByRole('checkbox',{name:PRIVACY}).check()
  await Promise.all([page.waitForURL((u:URL)=>!u.pathname.startsWith('/signup')), page.getByRole('button',{name:'가입하기'}).click()])
}

test('레퍼런스: 요청 생성 → 설문 조회 → 설문 제출 → 완료', async ({ page, browser }) => {
  // 세입자가 이전 집주인에게 레퍼런스 요청
  await su(page, `ref_${Date.now()}@example.com`)
  const create = await page.request.post('/api/references', {
    data: { landlordName: '김집주', landlordPhone: '01012345678', landlordEmail: 'former-landlord@example.com' },
  })
  console.log('CREATE_STATUS', create.status())
  const cbody = await create.json()
  console.log('CREATE_BODY', JSON.stringify(cbody).slice(0, 200))
  expect(create.ok()).toBeTruthy()
  // dev 응답의 surveyUrl에서 토큰 추출
  const surveyUrl: string | undefined = cbody.surveyUrl || cbody.data?.surveyUrl
  expect(surveyUrl).toBeTruthy()
  const token = surveyUrl!.split('/reference/survey/')[1]
  console.log('TOKEN', token?.slice(0, 12))

  // 집주인(참조인)은 토큰 기반, 인증 불필요 → 새 컨텍스트
  const rctx = await browser.newContext()
  const rp = await rctx.newPage()
  const getV = await rp.request.get(`/api/references/verify/${token}`)
  console.log('VERIFY_GET', getV.status())
  expect(getV.ok()).toBeTruthy()

  // 설문 제출
  const submit = await rp.request.post(`/api/references/verify/${token}`, {
    data: { rentPayment: 5, propertyCondition: 5, neighborIssues: 5, checkoutCondition: 4, wouldRecommend: true, comment: '성실한 세입자였습니다.' },
  })
  console.log('SUBMIT_STATUS', submit.status())
  console.log('SUBMIT_BODY', JSON.stringify(await submit.json()).slice(0, 200))
  expect(submit.ok()).toBeTruthy()

  // 완료 확인: 세입자의 레퍼런스 목록에 completed 반영
  const list = await page.request.get('/api/references')
  const lbody = await list.json()
  const refs = Array.isArray(lbody) ? lbody : (lbody.references || lbody.data || [])
  const completed = refs.some((r: any) => r.status === 'completed')
  console.log('TENANT_REFS', refs.length, 'has_completed', completed)
  expect(completed).toBeTruthy()

  await rctx.close()
})
