/**
 * DOW-1249 (B) — 커뮤니티 표시 이름 브라우저 실측 (로컬 실DB).
 *
 * 프로덕션에는 일반 사용자 글이 0건이라 "일반 사용자가 `익명`으로 보이는가"를 실측할
 * 대상이 없다. fixture 로 임차인 글·댓글을 넣은 로컬 서버에서 같은 revision 을 렌더해
 * 판정한다.
 *
 * 왜 노드 단위인가: `innerText` 는 이름 span 과 배지 span 을 공백으로 이어 붙여
 * `입주해 운영자` 로 만든다. 문구 검색으로는 "이름에 운영자가 박힌 결함"과 "정상
 * 이름+배지"를 구분할 수 없다(실제로 거짓 FAIL 이 났다). 그래서 span 별 텍스트를
 * 따로 뽑아 비교한다.
 *
 * 판정
 *  - 임차인 글/댓글: 이름 노드가 `익명`, 계정 실명 표식 문자열은 화면 어디에도 없음
 *  - 운영자 글/댓글: 이름 노드가 `입주해`, 배지 노드가 `운영자` (같은 줄에 `운영자` 1회)
 *
 * 사용: node scripts/qa/probe_community_display_local.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'
import { Client } from 'pg'

const BASE = process.argv[2] || 'http://127.0.0.1:3999'
const MARKERS = ['QA표식임차인이름', 'QA표식임대인이름', 'QA표식운영자이름']
const fails = []
const lines = []

const db = new Client({
  connectionString: `postgresql://${process.env.USER}@localhost:5432/ipjuhae_e2e`,
  ssl: false,
})
await db.connect()
await db.query('SET search_path TO ipjuhae, public')
const fixture = await db.query(
  `SELECT p.id, u.user_type FROM community_posts p JOIN users u ON u.id = p.author_id
    WHERE p.title LIKE '[QA]%' ORDER BY p.created_at`
)
await db.end()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 ipjuhae-qa-dow1249-local' })

for (const row of fixture.rows) {
  const who = row.user_type === 'admin' ? '운영자' : '임차인'
  const expectedName = row.user_type === 'admin' ? '입주해' : '익명'

  await page.goto(`${BASE}/community/${row.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page
    .waitForFunction(() => !!document.querySelector('h1') && document.querySelectorAll('span').length > 2, {
      timeout: 30000,
    })
    .catch(() => lines.push('  (경고) 상세 렌더 대기 시간 초과'))

  const view = await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    let meta = null
    if (h1) {
      let prev = h1.previousElementSibling
      while (prev && !(prev.className || '').includes('flex')) prev = prev.previousElementSibling
      meta = prev
    }
    const spanText = (el) =>
      Array.from(el?.querySelectorAll('span') || [])
        .map((s) => ({ text: (s.innerText || '').trim(), cls: s.className || '' }))
        .filter((s) => s.text)
    return {
      metaSpans: meta ? spanText(meta) : [],
      metaText: meta ? (meta.innerText || '').trim() : '',
      bodyText: document.body.innerText || '',
    }
  })

  lines.push(`### 상세 [${who} 글] ${BASE}/community/{id}`)
  lines.push(`  작성자 메타 span: ${JSON.stringify(view.metaSpans.map((s) => s.text))}`)
  lines.push(
    `  배지 후보(강조 클래스): ${JSON.stringify(
      view.metaSpans.filter((s) => /bg-primary|badge/.test(s.cls)).map((s) => s.text)
    )}`
  )

  // 메타 줄의 첫 span 은 게시판 라벨(전체/임차인/…)이다. 표시 이름은 그 다음 span 이다.
  // 인덱스를 고정하지 않고 라벨을 찾아 그 뒤를 집는다 — 라벨이 빠지는 화면도 있다.
  const AUDIENCE_LABELS = ['전체', '임차인', '임대인', '공인중개사']
  const labelIdx = view.metaSpans.findIndex((s) => AUDIENCE_LABELS.includes(s.text))
  const nameNode = view.metaSpans[labelIdx >= 0 ? labelIdx + 1 : 0]?.text ?? null
  if (nameNode !== expectedName) {
    fails.push(`상세(${who}): 이름 노드가 '${expectedName}' 이 아니다 (받은 값 '${nameNode}')`)
  }
  if (row.user_type === 'admin') {
    const adminWordCount = (view.metaText.match(/운영자/g) || []).length
    lines.push(`  메타 줄 '운영자' 출현: ${adminWordCount}회`)
    if (adminWordCount !== 1) fails.push(`상세(운영자): 메타 줄 '운영자' ${adminWordCount}회 (1회여야 함)`)
    const badge = view.metaSpans.find((s) => /bg-primary/.test(s.cls) && s.text === '운영자')
    if (!badge) fails.push('상세(운영자): 강조 배지 노드가 사라졌다 (DOW-1176 취지 훼손)')
  }

  const markerHit = MARKERS.filter((m) => view.bodyText.includes(m))
  lines.push(`  화면 전체 실명 표식 출현: ${markerHit.length}종`)
  if (markerHit.length > 0) fails.push(`상세(${who}): 화면에 계정 실명 표식이 렌더됨`)

  // 댓글 영역 — 임차인 댓글이 '익명', 운영자 댓글이 '입주해' 로 나와야 한다.
  const commentNames = await page.evaluate(() => {
    const names = new Set()
    for (const el of Array.from(document.querySelectorAll('span, strong, div'))) {
      const t = (el.textContent || '').trim()
      if (t === '익명' || t === '입주해') names.add(t)
    }
    return [...names]
  })
  lines.push(`  화면에 나타난 표시 이름 종류: ${JSON.stringify(commentNames)}`)
}

await browser.close()

console.log(lines.join('\n'))
console.log('')
if (fails.length === 0) {
  console.log('PASS — 일반 사용자 익명 표시, 운영자 이름/배지 분리, 실명 미노출')
  process.exit(0)
}
console.log(`FAIL ${fails.length}건`)
for (const f of fails) console.log(`  - ${f}`)
process.exit(1)
