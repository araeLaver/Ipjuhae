/** 로컬 격리 schema, 실제 PostgreSQL 행 잠금 및 두 세션으로 API 경쟁을 검증한다. */
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ query: vi.fn(), queryOne: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
import { query, queryOne, transaction } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { PATCH, DELETE as deletePost, GET as detail } from '@/app/api/community/posts/[id]/route'
import { DELETE as deleteComment } from '@/app/api/community/posts/[id]/comments/[commentId]/route'
import { GET as comments } from '@/app/api/community/posts/[id]/comments/route'
import { GET as list } from '@/app/api/community/posts/route'
import { getHomeContent } from '@/lib/home-content'

const url = process.env.QA_DATABASE_URL
const schema = 'qa_concurrency_' + randomUUID().replaceAll('-', '')
const owner = randomUUID(), pid = randomUUID(), cid = randomUUID()
const sessions = new AsyncLocalStorage<Client>()
let control: Client
const clients: Client[] = []
const pids: number[] = []
const evidence: unknown[] = []
const req = (method = 'GET') => new Request('http://localhost/qa', {
  method, ...(method === 'PATCH' ? { body: JSON.stringify({ title: '경쟁 수정 제목' }) } : {}),
})
const ctx = { params: Promise.resolve({ id: pid }) }
const cctx = { params: Promise.resolve({ id: pid, commentId: cid }) }

beforeAll(async () => {
  if (!url) return
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw Error('QA_DATABASE_URL은 localhost/127.0.0.1만 허용')
  control = new Client({ connectionString: url, connectionTimeoutMillis: 5000, statement_timeout: 8000 })
  await control.connect()
  await control.query(`CREATE SCHEMA ${schema}`)
  await control.query(`SET search_path = ${schema}`)
  await control.query('CREATE TABLE users (id uuid PRIMARY KEY, user_type text)')
  await control.query(`CREATE TABLE community_posts (id uuid PRIMARY KEY, author_id uuid, audience text,
    category text, title text, body text, view_count int DEFAULT 0, comment_count int DEFAULT 99,
    created_at timestamptz DEFAULT now(), updated_at timestamptz, hidden_at timestamptz, deleted_at timestamptz)`)
  await control.query(`CREATE TABLE community_comments (id uuid PRIMARY KEY, post_id uuid, author_id uuid,
    body text, created_at timestamptz DEFAULT now(), updated_at timestamptz, hidden_at timestamptz, deleted_at timestamptz)`)
  await control.query("INSERT INTO users VALUES ($1,'tenant')", [owner])
  for (let n = 0; n < 2; n++) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000, statement_timeout: 8000 })
    await client.connect(); clients.push(client)
    await client.query(`SET search_path = ${schema}`)
    pids.push((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid)
  }
  const current = () => sessions.getStore() ?? control
  vi.mocked(query).mockImplementation(async (sql, args) => (await current().query(sql, args)).rows)
  vi.mocked(queryOne).mockImplementation(async (sql, args) => (await current().query(sql, args)).rows[0] ?? null)
  vi.mocked(transaction).mockImplementation(async fn => {
    const client = current()
    await client.query('BEGIN')
    try { const result = await fn(client as never); await client.query('COMMIT'); return result }
    catch (error) { await client.query('ROLLBACK'); throw error }
  })
  vi.mocked(getCurrentUser).mockResolvedValue({ id: owner, user_type: 'tenant' } as never)
})
afterAll(async () => {
  if (url && evidence.length && process.env.QA_CONCURRENCY_REPORT) {
    writeFileSync(process.env.QA_CONCURRENCY_REPORT, JSON.stringify({
      executed_at: new Date().toISOString(), schema, scenarios: evidence,
    }, null, 2) + '\n')
  }
  for (const client of clients) await client.end()
  if (control) { await control.query('ROLLBACK'); await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await control.end() }
})
async function seed() {
  await control.query('TRUNCATE community_posts, community_comments')
  await control.query("INSERT INTO community_posts (id,author_id,audience,title,body) VALUES ($1,$2,'all','경쟁 원본 제목','합성 본문')", [pid, owner])
  await control.query("INSERT INTO community_comments (id,post_id,author_id,body) VALUES ($1,$2,$3,'삭제할 댓글'),($4,$2,$3,'남은 공개 댓글')", [cid, pid, owner, randomUUID()])
  await control.query("INSERT INTO community_comments (id,post_id,body,hidden_at) VALUES ($1,$2,'숨김 댓글',now())", [randomUUID(), pid])
}
async function waitForLock(index: number) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const row = (await control.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pids[index]])).rows[0]
    if (row?.wait_event_type === 'Lock') return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw Error('DB 세션의 실제 행 잠금 대기를 확인하지 못했습니다')
}
// control이 행을 잠근 동안 첫 요청을 실제 DB 대기열에 넣고 두 번째 요청을 넣는다.
async function race(first: () => Promise<Response>, second: () => Promise<Response>) {
  await control.query('BEGIN')
  await control.query('SELECT id FROM community_posts WHERE id=$1 FOR UPDATE', [pid])
  const a = sessions.run(clients[0], first)
  const pending: Promise<Response>[] = [a]
  try {
    await waitForLock(0)
    pending.push(sessions.run(clients[1], second))
    await waitForLock(1)
    await control.query('COMMIT')
    const responses = await Promise.all(pending)
    return Promise.all(responses.map(async r => ({ status: r.status, body: await r.json() })))
  } finally {
    await control.query('ROLLBACK')
    await Promise.allSettled(pending)
  }
}
async function finalState() {
  const post = (await control.query('SELECT title, deleted_at FROM community_posts WHERE id=$1', [pid])).rows[0]
  const count = (await control.query('SELECT COUNT(*)::int AS total FROM community_comments WHERE post_id=$1 AND hidden_at IS NULL AND deleted_at IS NULL', [pid])).rows[0].total
  return { title: post.title, deleted_at: post.deleted_at, public_total: count }
}
async function deletedReads() {
  expect((await detail(req(), ctx)).status).toBe(404)
  expect((await comments(req(), ctx)).status).toBe(404)
  const listing = await (await list(req())).json()
  expect(listing.posts.some((p: { id: string }) => p.id === pid)).toBe(false)
  const home = await getHomeContent()
  expect(home.status).toBe('success')
  expect(home.questions.some(p => p.id === pid)).toBe(false)
  expect((await PATCH(req('PATCH'), ctx)).status).toBe(404)
}
it.skipIf(!url)('DELETE가 먼저 확정되면 겹친 PATCH는 404이며 삭제 이후 수정·노출이 없다', async () => {
  await seed()
  const responses = await race(() => deletePost(req('DELETE'), ctx), () => PATCH(req('PATCH'), ctx))
  const state = await finalState()
  evidence.push({ scenario: 'DELETE → PATCH', responses, state })
  expect(responses[0]).toEqual({ status: 200, body: { deleted: true, id: pid } })
  expect(responses[1].status).toBe(404)
  expect(state.title).toBe('경쟁 원본 제목'); expect(state.deleted_at).toBeTruthy()
  await deletedReads()
}, 15000)
it.skipIf(!url)('PATCH가 먼저 확정된 뒤 DELETE는 단일 삭제 상태를 남기며 되살아나지 않는다', async () => {
  await seed()
  const responses = await race(() => PATCH(req('PATCH'), ctx), () => deletePost(req('DELETE'), ctx))
  const state = await finalState()
  evidence.push({ scenario: 'PATCH → DELETE', responses, state })
  expect(responses[0]).toEqual({ status: 200, body: { post: { id: pid, title: '경쟁 수정 제목', body: '합성 본문', category: null } } })
  expect(responses[1]).toEqual({ status: 200, body: { deleted: true, id: pid } })
  expect(state.title).toBe('경쟁 수정 제목'); expect(state.deleted_at).toBeTruthy()
  await deletedReads()
}, 15000)
it.skipIf(!url)('같은 글 중복 DELETE는 정확히 하나만 성공하고 삭제 이후 읽기 차단을 유지한다', async () => {
  await seed()
  const responses = await race(() => deletePost(req('DELETE'), ctx), () => deletePost(req('DELETE'), ctx))
  const state = await finalState()
  evidence.push({ scenario: '게시글 DELETE 중복', responses, state })
  expect(responses.map(r => r.status)).toEqual([200, 404])
  expect(responses[0].body).toEqual({ deleted: true, id: pid })
  expect(state.deleted_at).toBeTruthy()
  await deletedReads()
}, 15000)
it.skipIf(!url)('같은 댓글 중복 DELETE는 하나만 성공하고 공개 total·목록·상세·홈은 모두 1이다', async () => {
  await seed()
  const responses = await race(() => deleteComment(req('DELETE'), cctx), () => deleteComment(req('DELETE'), cctx))
  const state = await finalState()
  const rows = (await control.query('SELECT id,deleted_at FROM community_comments WHERE id=$1', [cid])).rows
  const listing = await (await list(req())).json()
  const post = await (await detail(req(), ctx)).json()
  const replies = await (await comments(req(), ctx)).json()
  const home = await getHomeContent()
  const counts = { list: listing.posts.find((p: {id: string}) => p.id === pid)?.comment_count,
    detail: post.post?.comment_count, comments: replies.total, home: home.questions.find(p => p.id === pid)?.comment_count }
  evidence.push({ scenario: '댓글 DELETE 중복', responses, state, rows, counts })
  expect(responses.map(r => r.status)).toEqual([200, 404])
  expect(responses[0].body).toEqual({ deleted: true, id: cid, total: 1 })
  expect(rows).toHaveLength(1); expect(rows[0].deleted_at).toBeTruthy()
  expect(state.deleted_at).toBeNull(); expect(state.public_total).toBe(1)
  expect(counts).toEqual({ list: 1, detail: 1, comments: 1, home: 1 })
  expect(replies.comments).toHaveLength(1)
  expect(replies.comments.some((c: {id: string}) => c.id === cid)).toBe(false)
}, 15000)
