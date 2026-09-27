/**
 * DOW-1249 (A)(B) — 커뮤니티 익명화 payload 실측 (로컬 실DB).
 *
 * 왜 로컬인가: 프로덕션에는 댓글 0행·일반 사용자 글 0행이라 목록/상세 외에는 실측할
 * 데이터가 없다. 빈 배열에 대고 "author_name 키가 없다"고 쓰면 거짓 통과다. 그래서
 * 배포된 것과 같은 revision 을 로컬 실DB 로 띄우고, 실명이 들어간 계정이 쓴 글·댓글을
 * 넣어 응답을 직접 받는다.
 *
 * 판정 두 겹
 *  1) 금지 키 부재 — `author_name`·`author_id`
 *  2) 표식 문자열 부재 — fixture 가 넣은 계정 실명이 응답 본문 어디에도 없어야 한다.
 *     키만 보면 다른 키에 이름이 실려 나가는 경우를 놓친다.
 *
 * 사용: node scripts/qa/probe_community_anonymity_local.mjs [baseUrl]
 */
import { Client } from 'pg'

const BASE = process.argv[2] || 'http://127.0.0.1:3999'
const FORBIDDEN_KEYS = ['author_name', 'author_id', 'name', 'email', 'phone', 'author_hash']
const MARKERS = ['QA표식임차인이름', 'QA표식임대인이름', 'QA표식운영자이름']

const fails = []
const lines = []

function keysOf(obj) {
  return obj && typeof obj === 'object' ? Object.keys(obj).sort() : []
}

function checkMarkers(label, rawText) {
  const hit = MARKERS.filter((m) => rawText.includes(m))
  if (hit.length > 0) fails.push(`${label}: 응답 본문에 계정 실명 표식이 실려 나옴 (${hit.length}종)`)
  return hit.length
}

function checkKeys(label, keys) {
  const bad = keys.filter((k) => FORBIDDEN_KEYS.includes(k))
  if (bad.length > 0) fails.push(`${label}: 금지 키 노출 ${JSON.stringify(bad)}`)
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'user-agent': 'ipjuhae-qa-dow1249' } })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* 비-JSON 응답은 아래에서 상태코드로 드러난다 */
  }
  return { res, text, json }
}

// fixture 가 만든 글 id 를 DB 에서 직접 읽는다(목록 응답이 잘려도 실측 대상을 잃지 않는다).
const db = new Client({
  connectionString: `postgresql://${process.env.USER}@localhost:5432/ipjuhae_e2e`,
  ssl: false,
})
await db.connect()
await db.query('SET search_path TO ipjuhae, public')
const fixture = await db.query(
  `SELECT p.id, p.title, p.comment_count, u.user_type
     FROM community_posts p JOIN users u ON u.id = p.author_id
    WHERE p.title LIKE '[QA]%' ORDER BY p.created_at`
)
await db.end()

if (fixture.rows.length === 0) {
  console.error('fixture 글이 없다 — seed_community_anonymity_fixture.mjs 를 먼저 돌릴 것')
  process.exit(2)
}

// ── 1. 목록 ──────────────────────────────────────────────────────────────────
{
  const { res, text, json } = await getJson('/api/community/posts?limit=50')
  lines.push(`### 목록 GET /api/community/posts?limit=50 → ${res.status}`)
  lines.push(`  top-level 키: ${JSON.stringify(keysOf(json))}`)
  const item = json?.posts?.[0]
  lines.push(`  글 수: ${json?.posts?.length ?? 0}`)
  lines.push(`  item 키: ${JSON.stringify(keysOf(item))}`)
  checkKeys('목록 item', keysOf(item))
  const hits = checkMarkers('목록', text)
  lines.push(`  실명 표식 출현: ${hits}종`)
  if (res.status !== 200) fails.push(`목록 상태코드 ${res.status}`)
}

// ── 2. 상세 + 3. 댓글 ────────────────────────────────────────────────────────
for (const row of fixture.rows) {
  const who = row.user_type === 'admin' ? '운영자 글' : '일반 사용자(임차인) 글'

  const detail = await getJson(`/api/community/posts/${row.id}`)
  lines.push(`### 상세 [${who}] GET /api/community/posts/{id} → ${detail.res.status}`)
  lines.push(`  top-level 키: ${JSON.stringify(keysOf(detail.json))}`)
  lines.push(`  post 키: ${JSON.stringify(keysOf(detail.json?.post))}`)
  lines.push(`  author_role 값: ${JSON.stringify(detail.json?.post?.author_role ?? null)}`)
  checkKeys(`상세(${who})`, keysOf(detail.json?.post))
  lines.push(`  실명 표식 출현: ${checkMarkers(`상세(${who})`, detail.text)}종`)
  if (detail.res.status !== 200) fails.push(`상세(${who}) 상태코드 ${detail.res.status}`)

  const comments = await getJson(`/api/community/posts/${row.id}/comments`)
  const arr = comments.json?.comments ?? []
  lines.push(`### 댓글 [${who}] GET /api/community/posts/{id}/comments → ${comments.res.status}`)
  lines.push(`  top-level 키: ${JSON.stringify(keysOf(comments.json))}`)
  lines.push(`  댓글 행 수: ${arr.length} (DB comment_count=${row.comment_count})`)
  const itemKeys = [...new Set(arr.flatMap((c) => keysOf(c)))].sort()
  lines.push(`  item 키(전 행 합집합): ${JSON.stringify(itemKeys)}`)
  lines.push(`  author_role 값 분포: ${JSON.stringify([...new Set(arr.map((c) => c.author_role))])}`)
  checkKeys(`댓글(${who})`, itemKeys)
  lines.push(`  실명 표식 출현: ${checkMarkers(`댓글(${who})`, comments.text)}종`)
  if (comments.res.status !== 200) fails.push(`댓글(${who}) 상태코드 ${comments.res.status}`)
  // 행이 0이면 키에 대해 아무것도 증명하지 못한다 — 통과로 적지 않는다.
  if (arr.length === 0) fails.push(`댓글(${who}): 행 0 — 키 판정 불가`)
}

console.log(lines.join('\n'))
console.log('')
if (fails.length === 0) {
  console.log('PASS — 금지 키 없음, 계정 실명 표식 없음, 댓글 행 존재')
  process.exit(0)
}
console.log(`FAIL ${fails.length}건`)
for (const f of fails) console.log(`  - ${f}`)
process.exit(1)
