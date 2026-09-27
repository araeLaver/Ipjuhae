// DOW-1249 (A)(B) 실측용 로컬 fixture.
//
// 프로덕션에는 댓글 0행·일반 사용자 글 0행이라 목록/상세 외 payload 를 실측할 데이터가
// 없다. 빈 배열로 "author_name 키가 없다"고 쓰면 거짓 통과다. 그래서 같은 revision 을
// 로컬 실DB 로 띄우고, **실명이 들어간 계정**이 쓴 글·댓글을 넣어 응답 payload 에 그
// 실명이 실려 나오는지 직접 확인한다.
//
// 표식 이름을 쓰는 이유: 응답 어디에도 이 문자열이 없어야 통과다. 키 부재만 보면
// 다른 키에 이름이 실려 나가는 경우를 놓친다.
//
// 사용: node scripts/qa/seed_community_anonymity_fixture.mjs [db이름]
import { Client } from 'pg'

const dbName = process.argv[2] || 'ipjuhae_e2e'
if (!/^ipjuhae_(e2e|local|test)[a-z0-9_]*$/.test(dbName)) {
  console.error(`거부: 로컬 검증용 DB 이름만 허용한다 (받은 값: ${dbName})`)
  process.exit(1)
}

export const MARKERS = {
  tenantName: 'QA표식임차인이름',
  landlordName: 'QA표식임대인이름',
  adminName: 'QA표식운영자이름',
}

const client = new Client({
  connectionString: `postgresql://${process.env.USER}@localhost:5432/${dbName}`,
  ssl: false,
})
await client.connect()
await client.query('SET search_path TO ipjuhae, public')

async function upsertUser(email, name, userType) {
  const r = await client.query(
    `INSERT INTO users (email, name, user_type, password_hash)
     VALUES ($1, $2, $3, 'qa-not-a-real-hash')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, user_type = EXCLUDED.user_type
     RETURNING id`,
    [email, name, userType]
  )
  const id = r.rows[0].id
  // profiles.name 이 임차인 검증용 실명이다 — DOW-1236 의 누출 대상이 바로 이 값이다.
  await client.query(
    `INSERT INTO profiles (user_id, name) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name`,
    [id, name]
  )
  return id
}

const tenant = await upsertUser('qa-tenant-anon@example.invalid', MARKERS.tenantName, 'tenant')
const landlord = await upsertUser('qa-landlord-anon@example.invalid', MARKERS.landlordName, 'landlord')
const admin = await upsertUser('qa-admin-anon@example.invalid', MARKERS.adminName, 'admin')

async function upsertPost(authorId, title, audience) {
  const existing = await client.query('SELECT id FROM community_posts WHERE title = $1', [title])
  if (existing.rows[0]) return existing.rows[0].id
  const r = await client.query(
    `INSERT INTO community_posts (author_id, audience, category, title, body)
     VALUES ($1, $2, 'question', $3, $4) RETURNING id`,
    [authorId, audience, title, 'DOW-1249 익명화 실측용 본문입니다. 개인정보는 없습니다.']
  )
  return r.rows[0].id
}

const tenantPost = await upsertPost(tenant, '[QA] 일반 사용자(임차인) 글 — 익명 표시 실측', 'all')
const adminPost = await upsertPost(admin, '[QA] 운영자 글 — 표시 이름 실측', 'all')

async function ensureComment(postId, authorId, body) {
  const existing = await client.query(
    'SELECT id FROM community_comments WHERE post_id = $1 AND author_id = $2',
    [postId, authorId]
  )
  if (existing.rows[0]) return existing.rows[0].id
  const r = await client.query(
    'INSERT INTO community_comments (post_id, author_id, body) VALUES ($1, $2, $3) RETURNING id',
    [postId, authorId, body]
  )
  await client.query(
    `UPDATE community_posts SET comment_count = (
       SELECT COUNT(*) FROM community_comments
        WHERE post_id = $1 AND deleted_at IS NULL AND hidden_at IS NULL
     ) WHERE id = $1`,
    [postId]
  )
  return r.rows[0].id
}

await ensureComment(tenantPost, tenant, '임차인 댓글입니다 (QA)')
await ensureComment(tenantPost, landlord, '임대인 댓글입니다 (QA)')
await ensureComment(tenantPost, admin, '운영자 댓글입니다 (QA)')
await ensureComment(adminPost, tenant, '운영자 글에 달린 임차인 댓글입니다 (QA)')

const summary = await client.query(
  `SELECT p.id, p.title, p.audience, p.comment_count, u.user_type
     FROM community_posts p JOIN users u ON u.id = p.author_id
    WHERE p.title LIKE '[QA]%' ORDER BY p.created_at`
)
console.log(JSON.stringify({ tenantPost, adminPost, posts: summary.rows, markers: MARKERS }, null, 1))
await client.end()
